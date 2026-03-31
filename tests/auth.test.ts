import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoomAuth } from '../src/auth.js';

describe('ZoomAuth', () => {
  const mockCredentials = {
    accountId: 'test-account',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a new token on first call', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test-token-123',
        expires_in: 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    const token = await auth.getToken();

    expect(token).toBe('test-token-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://zoom.us/oauth/token');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    // Check Basic auth header
    const expectedBasic = Buffer.from('test-client:test-secret').toString('base64');
    expect(options.headers['Authorization']).toBe(`Basic ${expectedBasic}`);
  });

  it('returns cached token on subsequent calls', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'cached-token',
        expires_in: 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    await auth.getToken();
    const token2 = await auth.getToken();

    expect(token2).toBe('cached-token');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
  });

  it('refreshes token when expired', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'old-token',
          expires_in: 0, // Expires immediately
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    await auth.getToken();
    const token2 = await auth.getToken();

    expect(token2).toBe('new-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on auth failure', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid credentials',
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    await expect(auth.getToken()).rejects.toThrow('Zoom auth failed');
  });
});
