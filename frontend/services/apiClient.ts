const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiError<T = unknown> extends Error {
  public readonly status: number;
  public readonly data: T | null;

  constructor(message: string, status: number, data: T | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export class UnauthorizedError<T = unknown> extends ApiError<T> {
  constructor(message = "Unauthorized", data: T | null = null) {
    super(message, 401, data);
    this.name = "UnauthorizedError";
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const hasJsonBody =
    options.body && !(options.body instanceof FormData) && !headers.has("Content-Type");
  if (hasJsonBody) {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const payload = (await parseJsonSafe(response)) as T | null;

  if (!response.ok) {
    if (response.status === 401) {
      throw new UnauthorizedError("Unauthorized", payload);
    }
    throw new ApiError(response.statusText || "Request failed", response.status, payload);
  }

  return payload as T;
}
