type ApiResult<T = unknown> = { data: T };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null) as T;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { data };
}

export const api = {
  get: <T = any>(url: string) => request<T>(url),
  post: <T = any>(url: string, data?: unknown) => request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  }),
};
