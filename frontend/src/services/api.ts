const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api").replace(/\/$/, "");
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = payload as { error?: unknown } | undefined;
    if (typeof error?.error === "string") throw new Error(error.error);
    if (error?.error && typeof error.error === "object") {
      throw new Error(Object.values(error.error as Record<string, unknown>).flat().join(", "));
    }
    throw new Error("The API request failed.");
  }
  return payload as T;
}
