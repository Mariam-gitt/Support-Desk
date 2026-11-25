// The status type
import type { TicketStatus } from "../lib/types.js";

// A small coloured label showing a ticket's status
// DATA FLOW (parent -> child): the parent page passes the "status" prop down; this component never changes it
export function StatusBadge({ status }: { status: TicketStatus }) {
  // The CSS class (see styles.css) gives each status its own colour; replace turns IN_PROGRESS into a readable "IN PROGRESS"
  return <span className={`badge badge-${status.toLowerCase()}`}>{status.replace("_", " ")}</span>;
}
