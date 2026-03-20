# StayClean

StayClean is a mobile-first PWA for a single property manager handling short-stay apartment cleans. It runs as one TanStack Start app on Cloudflare Workers, uses Hono for API-style routes, stores operational data in D1, and sends push notifications back to the installed PWA.

## What is in v1

- TanStack Start app shell with Cloudflare Worker deployment config
- Hono API routes for auth, setup, push subscriptions, sync, and approval actions
- D1 schema for apartments, cleaners, bookings, manual cleans, weekly runs, assignments, suggested changes, and push subscriptions
- Deterministic scheduler focused on proximity, building split rules, and fairness
- iCal ingestion skeleton using `ical.js`
- Approval-gated suggestion flow for iCal changes
- Installable PWA with service worker and Web Push subscription support
- Client-side PDF export / mobile share flow
- GitHub Actions deployment via `cloudflare/wrangler-action@v3`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the local env template and fill in secrets:

```bash
cp .dev.vars.example .dev.vars
```

3. Create a D1 database in Cloudflare, then replace the placeholder `database_id` in [wrangler.jsonc](/Users/jordy/Projects/stay-clean/wrangler.jsonc).

4. Apply the schema:

```bash
npx wrangler d1 migrations apply stay-clean --local
npx wrangler d1 migrations apply stay-clean --remote
```

5. Start the app:

```bash
npm run dev
```

6. Seed local mock data:

```bash
npm run seed:mock
```

## Required secrets

- `ADMIN_PASSWORD`: manager login password
- `SESSION_SECRET`: cookie-signing secret
- `VAPID_PUBLIC_KEY`: public push key for the browser
- `VAPID_PRIVATE_KEY`: JWK private key for server push delivery
- `APP_BASE_URL`: public app URL used in push deep links

Generate VAPID keys with:

```bash
npx @pushforge/builder vapid
```

## Deployment

Manual deploy:

```bash
npm run deploy
```

Automated deploys are configured in [.github/workflows/deploy.yml](/Users/jordy/Projects/stay-clean/.github/workflows/deploy.yml). Add these GitHub repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Current workflow model

- iCal sync runs every 4 hours via Cloudflare cron.
- Draft weeks auto-refresh when bookings change.
- Confirmed weeks do not auto-mutate.
- If a confirmed week is impacted by iCal, the app creates a suggested change set, flags the week for review, and sends a push notification.

## Verification

The current scaffold has been verified with:

```bash
npm run build
```

For local testing, `npm run seed:mock` creates:

- 6 Cape Town apartments with coordinates
- 3 cleaners with availability
- current-week and next-week bookings
- a long-stay review case
- recurring and one-off manual cleans
- a seeded distance matrix
