type ApiResult<T = unknown> = { data: T };

const failureReason = (data: unknown, status: number): string => {
  if (data && typeof data === 'object' && 'reason' in data) {
    const reason = String((data as {reason?: unknown}).reason || '').trim();
    if (reason) return reason;
  }
  return `HTTP ${status}`;
};

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null) as T;
  if (!response.ok) throw new Error(failureReason(data, response.status));
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
