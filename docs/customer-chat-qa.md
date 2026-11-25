# Customer chat QA

## Files in implementation order

1. `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20261125220500_team_chat_refresh/migration.sql` add explicit message sender types and ticket-scoped public token hashes.
2. `apps/api/src/modules/tickets/publicChat.schema.ts` validates public requests.
3. `apps/api/src/modules/tickets/publicChat.service.ts` creates customer records/tickets/messages and checks capability tokens.
4. `apps/api/src/modules/tickets/publicChat.controller.ts` and `publicChat.routes.ts` expose rate-limited, public endpoints.
5. `apps/api/src/modules/tickets/ticket.service.ts` returns sender type for the staff conversation.
6. `apps/web/src/pages/PublicChatPage.tsx` provides the standalone customer chat at `/chat/:slug`; `TicketDetailPage.tsx` labels staff and customer messages.
7. `apps/api/tests/integration/public-chat.test.ts` and `apps/web/src/pages/PublicChatPage.test.tsx` cover the API and UI.

## Code flow

```text
Customer -> GET /api/public/widget/:slug -> read public business name
         -> POST /api/public/widget/:slug/conversations
         -> upsert customer in that organization -> create ticket + CUSTOMER message
         <- random access capability (only its SHA-256 hash is stored)
         -> emit the ticket/message and enqueue existing notification/SLA jobs
Customer -> GET/POST /api/public/conversations/:ticketId with capability
         -> verify ticket id + token hash -> read or add CUSTOMER message
Staff -> existing authenticated ticket routes -> add STAFF message
      -> both message types appear in the same chronological conversation
```

## Design choices

- The first release is a standalone customer page rather than an embedded script/iframe. It avoids cross-origin deployment and content-security complexity while providing a real public conversation flow.
- Email intake was not selected because the project has no inbound-email provider or mailbox configuration.
- Customers access a conversation with a random, unguessable capability token. Only the hash is stored and it is sent in an authorization header, not a URL.
- Existing messages migrate as `STAFF`; future records explicitly identify `STAFF` or `CUSTOMER`. Public ticket creation is rate-limited and validates all customer input.
- Customer messages on closed tickets are rejected; ticket lifecycle policy remains enforced by the server.

## Viva Q&A

**How do public messages avoid trusting customer identity?** The server looks up the ticket using both its id and the hash of its capability token, then derives the customer id from that ticket.

**Why keep sender type separate from sender id?** Staff messages reference a user, customer messages reference a customer, while the enum gives the UI and API one explicit discriminator.

**Can a customer access another organization's ticket?** Only if they possess that ticket's random capability. Ticket id alone is insufficient; every read/write checks the hash.

**What would embedding require later?** A small loader/iframe contract, approved origin configuration, and deployment/CSP testing; the API conversation capability can remain unchanged.
