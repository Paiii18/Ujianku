export type ApiBody<T> = { data: T } | { error: string };

// fetch JSON ke API Route sendiri. Koneksi putus → pesan error, bukan exception.
export async function callApi<T = null>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<ApiBody<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiBody<T>;
  } catch {
    return {
      error: "Tidak dapat terhubung ke server. Periksa koneksi internet.",
    };
  }
}
