// The type of the data we keep for a logged-in person
import type { LoginData } from "../lib/types.js";

// The names under which we save things in the browser's sessionStorage
const SESSION_KEY = "supportdesk.session";
// The chosen business is saved separately
const ORG_KEY = "supportdesk.org";

// Read the saved login (or null when nobody is logged in)
export function readSession(): LoginData | null {
  try {
    // sessionStorage = small storage that lives as long as the browser TAB; it survives a page refresh but not closing the tab
    const raw = sessionStorage.getItem(SESSION_KEY);
    // Turn the saved text back into an object (JSON = text format for data)
    return raw ? (JSON.parse(raw) as LoginData) : null;
  } catch {
    // Broken or blocked storage: act as if nobody is logged in
    return null;
  }
}

// Save the login so a page refresh does not log the person out
export function writeSession(session: LoginData) {
  // Objects must be turned into text before saving
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// Forget the login and the chosen business
export function clearSession() {
  // Remove both saved items
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ORG_KEY);
}

// Read which business was chosen last
export function readOrgId(): string | null {
  // Null when nothing was saved
  return sessionStorage.getItem(ORG_KEY);
}

// Remember which business was chosen
export function writeOrgId(orgId: string) {
  // Save the id as text
  sessionStorage.setItem(ORG_KEY, orgId);
}
