# Team invitations QA

## Files in implementation order

1. `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20261125220500_team_chat_refresh/migration.sql` add hashed, expiring invitations.
2. `apps/api/src/modules/organizations/team.service.ts` creates invitations, validates acceptance, assigns roles, and removes memberships.
3. `apps/api/src/modules/organizations/team.schema.ts`, `team.controller.ts`, and `invitation.controller.ts` validate and map the API.
4. `apps/api/src/modules/organizations/org.routes.ts` and `apps/api/src/modules/auth/auth.routes.ts` protect membership and acceptance routes.
5. `apps/web/src/pages/TeamPage.tsx` and `AcceptInvitationPage.tsx` provide invite creation and acceptance screens.
6. `apps/api/tests/integration/team.test.ts` and the matching web page tests verify behavior.

## Code flow

```text
Owner/Admin -> POST /orgs/:orgId/invitations -> role + tenant guards
            -> store SHA-256 token hash and expiry -> show raw token once as shareable link
Invitee -> /invite?token=... -> POST /auth/invitations/accept
        -> validate token/expiry and password for existing accounts
        -> create membership with invited role -> issue session
Owner/Admin -> DELETE /orgs/:orgId/members/:userId
            -> enforce role and owner protections -> delete membership
            -> disconnect that user's sockets from the business
```

## Design choices

- Links are shareable instead of emailed because no email-delivery provider is configured. An email integration can deliver the same one-time link later.
- Only the token hash is stored; the raw capability is returned once. Invitations expire after the configured seven-day default and are single-use.
- Owners can invite admins or agents. Admins can invite agents only. Neither can remove an owner; users cannot remove themselves.
- Existing accounts must enter their current password when accepting an invitation. This avoids silently attaching an invite to someone else's account.

## Viva Q&A

**Why does the database store a token hash?** A database read alone should not let someone redeem an outstanding invite.

**How is the role made effective?** Acceptance creates a `Membership` with the invited `Role`; all later requests load that role from the database.

**Why does a removed user get disconnected?** Removing their membership also terminates their active Socket.IO connection in that organization's room, so it cannot keep receiving events.

**How can delivery be changed to email?** Add a mail provider to the invitation creation flow; do not store or expose a plaintext invitation token beyond link delivery.
