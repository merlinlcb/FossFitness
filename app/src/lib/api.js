// Tiny client for the HealthHub server.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status; // 0 = could not reach the server
  }
}

export function normalizeServer(input) {
  let s = String(input || '').trim().replace(/\/+$/, '');
  if (s && !/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

export async function api(server, path, { method = 'GET', body, token, timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(`${normalizeServer(server)}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    // handled below
  }
  if (!res.ok) throw new ApiError(res.status, (json && json.error) || `Server error (${res.status}).`);
  if (json === null) throw new ApiError(res.status, 'The server sent an unexpected reply. Check the server address.');
  return json;
}
