# Support Desk

A multi-tenant customer support desk: many businesses, each with its own private workspace, tickets, customers and team.

```
apps/api   Express + PostgreSQL (Prisma) + Socket.IO + BullMQ jobs      -> http://localhost:5000
apps/web   React + Vite frontend (talks to the API through a dev proxy)  -> http://localhost:5173
```

## Run it (first time)
You need Node 20+ and a PostgreSQL database. (Redis is optional: it is only for background jobs.)

**1. API**
```
cd apps/api
npm install
cp .env.example .env        # then edit .env: set DATABASE_URL and a JWT_SECRET of 32+ characters
npx prisma migrate deploy   # creates the tables
npm run dev                 # look for: "Server running on port 5000"
```
**2. Web app** (a second terminal)
```
cd apps/web
npm install
npm run dev                 # look for: "Local: http://localhost:5173/"
```
**3. Open the app:** type `http://localhost:5173` into your browser's address bar.
Click "Create a business account", fill the form, and you are in. To watch live updates, open the app in a second tab (or a private window, logging in as the same person) and create a ticket in one of them.

## Team and customer conversations
Owners and admins can open **Team** to invite teammates with business-specific roles. Invitation links are single-use and expire; the owner can invite admins or agents, while admins can invite agents. The same page shows the standalone customer chat link (`/chat/<organization-slug>`), which can be shared with customers. Refresh tokens are held in httpOnly cookies; access tokens remain in memory.

## Background jobs (optional)
Set `REDIS_URL` in `apps/api/.env`, then run `npm run worker` in a third terminal.

## Tests
```
cd apps/api && npm test        # needs TEST_DATABASE_URL (a SEPARATE database whose name contains "test")
cd apps/web && npm test
```
Read `AGENTS.md` for the project rules and `docs/` for the explanation, design choices and viva questions of every step.
