/**
 * Safe API fetch wrapper — handles:
 * - Timeouts (20 s default — avoids "Erreur réseau." on slow cold starts)
 * - Non-JSON responses (HTML error pages from Vercel / proxies)
 * - HTTP error responses (extracts the server's `error` / `message` field)
 *
 * @throws {Error} with a user-readable French message on any failure
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, { ...options, credentials: options.credentials ?? 'include', signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Délai dépassé. Le serveur met trop longtemps à répondre — réessayez.');
    }
    throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion.');
  } finally {
    clearTimeout(timer);
  }

  // Safely detect content type to avoid res.json() throwing on HTML pages
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');

  let data: any;
  if (isJson) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // Server returned non-JSON (HTML 500 from Vercel, gateway error, etc.)
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(
        `Erreur serveur (${res.status}). Veuillez réessayer dans quelques instants.`,
      );
    }
    return text as any;
  }

  if (!res.ok) {
    throw new Error(
      data?.error || data?.message || `Erreur ${res.status}. Veuillez réessayer.`,
    );
  }

  return data as T;
}
