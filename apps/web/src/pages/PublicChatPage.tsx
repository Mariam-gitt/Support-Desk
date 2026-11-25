import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { errorMessage, formatDate } from "../lib/format.js";

type PublicWidget = { name: string; slug: string };
type PublicMessage = { id: string; body: string; createdAt: string; sender: { type: "STAFF" | "CUSTOMER"; name: string } };
type PublicConversation = {
  id: string;
  subject: string;
  status: string;
  messages: PublicMessage[];
};
type ConversationCredentials = { ticketId: string; accessToken: string };
type StartedConversation = {
  ticket: { id: string };
  accessToken: string;
};

function storedConversation(slug: string): ConversationCredentials | null {
  try {
    const raw = sessionStorage.getItem(`supportdesk.chat.${slug}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "ticketId" in parsed &&
      typeof parsed.ticketId === "string" &&
      "accessToken" in parsed &&
      typeof parsed.accessToken === "string"
    ) {
      return { ticketId: parsed.ticketId, accessToken: parsed.accessToken };
    }
    sessionStorage.removeItem(`supportdesk.chat.${slug}`);
    return null;
  } catch {
    return null;
  }
}

export function PublicChatPage() {
  const { slug = "" } = useParams();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<ConversationCredentials | null>(() => storedConversation(slug));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

  useEffect(() => {
    setCredentials(storedConversation(slug));
  }, [slug]);

  const organization = useQuery({
    queryKey: ["public-widget", slug],
    queryFn: () => api<PublicWidget>(`/public/widget/${encodeURIComponent(slug)}`, { auth: false }),
  });
  const conversation = useQuery({
    queryKey: ["public-conversation", credentials?.ticketId],
    queryFn: () => {
      if (!credentials) throw new Error("Conversation credentials are missing");
      return api<PublicConversation>(`/public/conversations/${credentials.ticketId}`, { auth: false, publicToken: credentials.accessToken });
    },
    enabled: Boolean(credentials),
    refetchInterval: 10_000,
  });
  const start = useMutation({
    mutationFn: () => api<StartedConversation>(`/public/widget/${encodeURIComponent(slug)}/conversations`, {
      method: "POST",
      auth: false,
      body: { customer: { name, email }, subject, body },
    }),
    onSuccess: (result) => {
      const saved = { ticketId: result.ticket.id, accessToken: result.accessToken };
      setCredentials(saved);
      try {
        sessionStorage.setItem(`supportdesk.chat.${slug}`, JSON.stringify(saved));
      } catch {
        console.error("Could not save this conversation in the browser session");
      }
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["public-conversation", result.ticket.id] });
    },
  });
  const sendReply = useMutation({
    mutationFn: () => {
      if (!credentials) throw new Error("Conversation credentials are missing");
      return api(`/public/conversations/${credentials.ticketId}/messages`, {
        method: "POST",
        auth: false,
        publicToken: credentials.accessToken,
        body: { body: reply },
      });
    },
    onSuccess: async () => {
      setReply("");
      await queryClient.invalidateQueries({ queryKey: ["public-conversation", credentials?.ticketId] });
    },
  });

  function submitConversation(event: FormEvent) {
    event.preventDefault();
    start.mutate();
  }

  function submitReply(event: FormEvent) {
    event.preventDefault();
    sendReply.mutate();
  }

  if (organization.isPending) return <main className="auth-page"><p>Loading support...</p></main>;
  if (organization.isError) return <main className="auth-page"><p className="error">{errorMessage(organization.error)}</p></main>;

  return (
    <main className="auth-page">
      <h1>{organization.data.name} support</h1>
      <p className="muted">Send a message to the support team. Replies will appear here.</p>
      {!credentials ? (
        <form className="card form" onSubmit={submitConversation}>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={200} required /></label>
          <label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={5000} required /></label>
          {start.isError && <p className="error">{errorMessage(start.error)}</p>}
          <button type="submit" disabled={start.isPending}>{start.isPending ? "Sending..." : "Start conversation"}</button>
        </form>
      ) : (
        <section>
          {conversation.isPending && <p>Loading conversation...</p>}
          {conversation.isError && <p className="error">{errorMessage(conversation.error)}</p>}
          {conversation.data && (
            <>
              <div className="card">
                <h2>{conversation.data.subject}</h2>
                <p className="muted">Status: {conversation.data.status}</p>
              </div>
              {conversation.data.messages.map((message) => (
                <article className="message" key={message.id}>
                  <strong>{message.sender.name} ({message.sender.type === "STAFF" ? "Support" : "You"})</strong>
                  <span className="muted"> · {formatDate(message.createdAt)}</span>
                  <p>{message.body}</p>
                </article>
              ))}
              {conversation.data.status !== "CLOSED" && (
                <form className="card form" onSubmit={submitReply}>
                  <label>Reply<textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={5000} required /></label>
                  {sendReply.isError && <p className="error">{errorMessage(sendReply.error)}</p>}
                  <button type="submit" disabled={sendReply.isPending}>{sendReply.isPending ? "Sending..." : "Send reply"}</button>
                </form>
              )}
              {conversation.data.status === "CLOSED" && <p className="muted">This conversation is closed.</p>}
            </>
          )}
        </section>
      )}
    </main>
  );
}
