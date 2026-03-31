import { ZoomAuth } from './auth.js';

export interface ZoomRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
}

export class ZoomClient {
  private auth: ZoomAuth;
  private baseUrl = 'https://api.zoom.us/v2';

  constructor(auth: ZoomAuth) {
    this.auth = auth;
  }

  async request<T = unknown>(path: string, options: ZoomRequestOptions = {}): Promise<T> {
    const { method = 'GET', params, body } = options;

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          search.set(key, String(value));
        }
      }
      const qs = search.toString();
      if (qs) url += `?${qs}`;
    }

    const response = await this.fetchWithAuth(url, method, body);

    // Handle 401 — refresh token and retry once
    if (response.status === 401) {
      await this.auth.refresh();
      const retry = await this.fetchWithAuth(url, method, body);
      return this.handleResponse<T>(retry);
    }

    return this.handleResponse<T>(response);
  }

  async fetchRaw(url: string): Promise<string> {
    const token = await this.auth.getToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      await this.auth.refresh();
      const token2 = await this.auth.getToken();
      const retry = await fetch(url, {
        headers: { Authorization: `Bearer ${token2}` },
      });
      if (!retry.ok) {
        throw new Error(`Zoom API error (${retry.status}): ${await retry.text()}`);
      }
      return retry.text();
    }

    if (!response.ok) {
      throw new Error(`Zoom API error (${response.status}): ${await response.text()}`);
    }
    return response.text();
  }

  private async fetchWithAuth(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const token = await this.auth.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const init: RequestInit = { method, headers };

    if (body) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    return fetch(url, init);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return {} as T;
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 'unknown';
      throw new Error(`Zoom API rate limited. Retry after ${retryAfter} seconds.`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zoom API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }
}
