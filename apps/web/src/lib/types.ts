// The shapes of the data the API sends us (kept in one place so the whole app agrees on them)

// A person's role inside one business
export type Role = "OWNER" | "ADMIN" | "AGENT";
// The stages of a ticket
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
// How urgent a ticket is
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

// One business the logged-in user belongs to, with their role there
export type Membership = { organizationId: string; organizationName: string; role: Role };
// The logged-in person
export type User = { id: string; name: string; email: string };
// What the login endpoint returns
export type LoginData = { token: string; user: User; memberships: Membership[] };

// A ticket as shown in lists
export type TicketSummary = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  // The customer who raised it
  customer: { id: string; name: string; email: string };
  // The staff member it is assigned to (null = nobody yet)
  assignee: { id: string; name: string } | null;
  // The status moves the SERVER allows next (the frontend never copies the rules)
  allowedNext: TicketStatus[];
};
// One reply in a conversation
export type Message = { id: string; body: string; createdAt: string; sender: { id: string; name: string } };
// A ticket with its full details and conversation
export type TicketDetail = TicketSummary & { description: string; messages: Message[] };
// A page of results with paging information
export type Page<T> = { items: T[]; page: number; limit: number; total: number };

// A customer in the list
export type CustomerRow = { id: string; name: string; email: string; createdAt: string; ticketCount: number };
// A customer with their full ticket history
export type CustomerHistory = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  tickets: { id: string; subject: string; status: TicketStatus; priority: TicketPriority; createdAt: string; updatedAt: string }[];
};
// A team member of a business
export type Member = { userId: string; name: string; email: string; role: Role };
