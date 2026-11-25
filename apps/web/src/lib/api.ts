import { clearSession } from "../auth/session.js";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const UNAUTHORIZED_EVENT = "supportdesk:unauthorized";
export const ACCESS_TOKEN_EVENT = "supportdesk:access-token";

type Options = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  publicToken?: string;
};

let accessToken: string | null = null;
let refreshRequest: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_EVENT, { detail: token }));
  }
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      const json = await response.json().catch(() => null);
      if (!response.ok || typeof json?.data?.token !== "string") return null;
      setAccessToken(json.data.token);
      return json.data.token as string;
    })().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

function notifyUnauthorized() {
  clearSession();
  setAccessToken(null);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function send(path: string, options: Options, token: string | null) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.publicToken) headers.Authorization = `Bearer ${options.publicToken}`;
  else if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  return fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
    credentials: "include",
  });
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let response = await send(path, options, accessToken);
  if (response.status === 401 && options.auth !== false) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await send(path, options, refreshedToken);
    else notifyUnauthorized();
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(json?.message ?? "Request failed", response.status, json);
  return json.data as T;
}
