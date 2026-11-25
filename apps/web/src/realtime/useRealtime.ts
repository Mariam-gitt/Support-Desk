// React hooks, and the query client we tell "your data is outdated, reload it"
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, UNAUTHORIZED_EVENT, api } from "../lib/api.js";
import type { LoginData } from "../lib/types.js";
// The Socket.IO browser library
import { io } from "socket.io-client";

// Keeps a live connection to the API for one business; returns true while connected and joined
export function useRealtime(orgId: string | null, token: string | null): boolean {
  // Gives us the shared cache of server data
  const queryClient = useQueryClient();
  // Are we connected and inside the business's room?
  const [live, setLive] = useState(false);

  // Runs when the business or token changes (and cleans up after itself)
  useEffect(() => {
    // Not logged in or no business: nothing to connect to
    if (!orgId || !token) return;
    // Connect to the same address as the page (Vite's proxy forwards it to the API); the token goes in the handshake
    const socket = io({ auth: { token } });
    let refreshing = false;

    // Fires on the first connection AND after every automatic reconnect
    socket.on("connect", () => {
      // Ask to receive this business's events; the callback is the server's answer
      socket.emit("org:join", orgId, (reply: { ok: boolean }) => setLive(reply.ok));
    });
    // The connection dropped (Socket.IO keeps trying to reconnect by itself)
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", (error: Error) => {
      if (error.message !== "Unauthorized" || refreshing) return;
      refreshing = true;
      void api<LoginData>("/auth/refresh", { method: "POST", auth: false })
        .catch((refreshError) => {
          if (refreshError instanceof ApiError && refreshError.status === 401) {
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
          } else {
            console.error("Could not refresh real-time session:", refreshError);
          }
        })
        .finally(() => {
          refreshing = false;
        });
    });

    // When anything changes on the server, mark our cached data for this business as outdated so screens reload it
    const refresh = () => {
      // Ticket lists (the key starts with "tickets" and this business id)
      queryClient.invalidateQueries({ queryKey: ["tickets", orgId] });
      // Single ticket pages
      queryClient.invalidateQueries({ queryKey: ["ticket", orgId] });
      // Customer lists and histories
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
    };
    // The three events the server pushes
    socket.on("ticket.created", refresh);
    socket.on("ticket.updated", refresh);
    socket.on("message.created", refresh);

    // Cleanup: close the connection when the person switches business, logs out or leaves
    return () => {
      socket.disconnect();
      setLive(false);
    };
  }, [orgId, token, queryClient]);

  // Tell the caller whether we are live
  return live;
}
