export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export class ZoomAuth {
  private credentials: ZoomCredentials;
  private token: string | null = null;
  private expiresAt: number = 0;

  constructor(credentials: ZoomCredentials) {
    this.credentials = credentials;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    return this.refresh();
  }

  async refresh(): Promise<string> {
    const { accountId, clientId, clientSecret } = this.credentials;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Zoom auth failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    // Expire 60 seconds early to avoid edge cases
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.token!;
  }
}
