// We read the saved token from here for every request, and clear the session when the server says it is no longer valid
import { clearSession, readSession } from "../auth/session.js";

// A special error that remembers the HTTP status and what the server said
export class ApiError extends Error {
  // The HTTP status code (404, 409, ...)
  status: number;
  // The full error body from the server (for example the list of allowed status moves)
  body: unknown;
  // Build the error
  constructor(message: string, status: number, body: unknown) {
    // Pass the message to the normal Error class
    super(message);
    // Keep the extra information
    this.status = status;
    this.body = body;
  }
}

// The name of the event we fire when the server rejects our token (the AuthProvider listens for it and logs the person out)
export const UNAUTHORIZED_EVENT = "supportdesk:unauthorized";

// The options one request may have
type Options = {
  // GET (read) by default; POST, PATCH, ... for changes
  method?: string;
  // Data to send; it is turned into JSON
  body?: unknown;
  // false for login and register, which are called without a token
  auth?: boolean;
};

// ONE function every screen uses to talk to the API: adds the token, reads the JSON, turns failures into ApiError
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  // Start with the headers every request needs
  const headers: Record<string, string> = {};
  // Only requests that send data need the JSON content type
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  // Add the login token unless this call is explicitly public
  if (options.auth !== false) {
    // Read the saved login
    const session = readSession();
    // "Bearer <token>" is the format our API's authenticate guard expects
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }

  // Send the request; paths start with /api and Vite's proxy forwards them to the real API
  const response = await fetch(`/api${path}`, {
    // GET unless told otherwise
    method: options.method ?? "GET",
    // The headers built above
    headers,
    // Turn the data into text (or send nothing)
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
  });

  // Read the JSON answer; if the body is not JSON (a server crash page), use null
  const json = await response.json().catch(() => null);

  // Any non-2xx status is a failure
  if (!response.ok) {
    // 401 on a protected call = our token expired or is fake, so the person must log in again
    if (response.status === 401 && options.auth !== false) {
      // Forget the saved login
      clearSession();
      // Tell the rest of the app (the AuthProvider reacts and shows the login page)
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    // Throw an error with the server's message, which screens can show to the person
    throw new ApiError(json?.message ?? "Request failed", response.status, json);
  }

  // Every successful API answer looks like { success, data }; return just the data
  return json.data as T;
}
