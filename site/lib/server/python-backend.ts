const BACKEND_URL = process.env.PY_BACKEND_URL?.replace(/\/+$/, "");

export function usePythonBackend(): boolean {
  return Boolean(BACKEND_URL);
}

function targetUrl(path: string): string {
  if (!BACKEND_URL) throw new Error("PY_BACKEND_URL is not configured");
  return BACKEND_URL + path;
}

export async function proxyToPython(req: Request, path: string): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
    init.duplex = "half";
  }

  return fetch(targetUrl(path), init);
}

export async function fetchPythonJson<T>(path: string): Promise<T | null> {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(targetUrl(path), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

