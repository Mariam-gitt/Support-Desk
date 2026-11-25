// Import the type of Node's built-in HTTP server (Socket.IO attaches itself to it)
import type { Server as HttpServer } from "node:http";
// Socket.IO = a library for real-time, two-way communication between server and browsers (built on WebSockets)
import { Server } from "socket.io";
// Import the shared database client (Prisma) to check memberships
import { prisma } from "../lib/prisma.js";
// Import our helper that checks a JWT and gives back the user id (the same one the REST guard uses)
import { verifyToken } from "../lib/jwt.js";
// The validated settings
import { env } from "../config/env.js";

// The names of the events the server may push to browsers (a fixed list avoids typos)
export type RealtimeEvent = "ticket.created" | "ticket.updated" | "message.created";

// The reply a client gets after asking to join a business's room
type JoinReply = { ok: boolean; message?: string };

// Holds the Socket.IO server once it is started (null until then, e.g. during tests)
let io: Server | null = null;

// A "room" = a named group of connections; every business gets its own room, so events never cross businesses
const roomName = (orgId: string) => `org:${orgId}`;
const userRoomName = (userId: string) => `user:${userId}`;

// Start real-time support on top of the HTTP server
export function initRealtime(httpServer: HttpServer) {
  // Browsers on OTHER websites may connect only if their address is listed in CORS_ORIGIN (comma separated); otherwise same-site only
  const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((o) => o.trim()) : false;
  // Create the Socket.IO server and attach it to the HTTP server (they share one port)
  io = new Server(httpServer, { cors: { origin: allowedOrigins } });

  // GUARD #1 (runs once per connection): only logged-in users may connect, using the same JWT as the REST API
  io.use((socket, next) => {
    // The browser sends the token in the connection "handshake": io({ auth: { token } })
    const token = socket.handshake.auth.token;
    // No token (or not text) means the visitor is not logged in
    if (typeof token !== "string") return next(new Error("Unauthorized"));
    try {
      // Verify the token and remember who is connected (socket.data is per-connection storage)
      socket.data.userId = verifyToken(token);
      // Allow the connection
      next();
    } catch {
      // Fake, edited or expired token: refuse the connection
      next(new Error("Unauthorized"));
    }
  });

  // Runs every time a browser successfully connects
  io.on("connection", (socket) => {
    void socket.join(userRoomName(socket.data.userId as string));

    // A small helper that answers the client's "acknowledgement" callback safely (the client may not have sent one)
    const reply = (ack: unknown, answer: JoinReply) => {
      // Only call it if it really is a function
      if (typeof ack === "function") ack(answer);
    };

    // The client asks to receive live events for one business
    socket.on("org:join", async (orgId: unknown, ack: unknown) => {
      // The business id must be text
      if (typeof orgId !== "string") return reply(ack, { ok: false, message: "Not found" });
      try {
        // GUARD #2: same rule as the REST API; you may only listen to a business you belong to (fresh DB lookup)
        const membership = await prisma.membership.findUnique({
          // The composite unique key (userId + organizationId)
          where: { userId_organizationId: { userId: socket.data.userId as string, organizationId: orgId } },
        });
        // Not a member: same answer as "does not exist", so strangers learn nothing
        if (!membership) return reply(ack, { ok: false, message: "Not found" });
        // Put this connection into the business's room; from now on it receives that business's events
        await socket.join(roomName(orgId));
        // Tell the client it worked
        reply(ack, { ok: true });
      } catch (error) {
        // Log unexpected errors on the server only
        console.error("Realtime join error:", error);
        // Tell the client something broke, without details
        reply(ack, { ok: false, message: "Something went wrong" });
      }
    });

    // The client no longer wants events for a business (for example after switching workspace)
    socket.on("org:leave", async (orgId: unknown) => {
      // Leave the room only if the id is text (leaving a room you are not in is harmless)
      if (typeof orgId === "string") await socket.leave(roomName(orgId));
    });
  });
}

// Push an event to everyone currently connected to one business's room
export function emitToOrg(orgId: string, event: RealtimeEvent, payload: unknown) {
  // "io?." means: do nothing if real-time was never started; "to(room)" limits delivery to that business only
  io?.to(roomName(orgId)).emit(event, payload);
}

export async function disconnectUserFromOrg(userId: string, orgId: string) {
  if (!io) return;
  const sockets = await io.in(userRoomName(userId)).fetchSockets();
  for (const socket of sockets) {
    if (socket.rooms.has(roomName(orgId))) socket.disconnect(true);
  }
}

export async function closeRealtime() {
  const activeServer = io;
  io = null;
  if (!activeServer) return;
  await new Promise<void>((resolve) => activeServer.close(() => resolve()));
}
