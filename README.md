# ResellerOS

The operating system for resellers. Turn photos into profits across every marketplace.

ResellerOS automates the grind of managing listings, handling offers, tracking inventory, and calculating profit so you can focus on sourcing. Take photos, ship orders -- the app does everything else.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **API**: tRPC (end-to-end type safety)
- **Database**: SQLite via Drizzle ORM, Turso for cloud sync
- **Background Jobs**: Inngest (event-driven, serverless)
- **AI**: OpenAI GPT-4o (listing generation, pricing)
- **Image Storage**: Cloudflare R2
- **Auth**: NextAuth.js with eBay OAuth
- **Hosting**: Vercel + Inngest Cloud
- **UI**: Tailwind CSS, Radix UI, Recharts

## Features

1. **eBay Integration** -- Native API: publish, update, delist, sync orders, import inventory
2. **Inventory Management** -- Full CRUD, image uploads, bulk operations, storage locations
3. **AI Listing Generation** -- Photos to complete listings via GPT-4o (title, description, price, category)
4. **Autopilot Engine** -- Auto-accept/decline/counter offers, smart repricing, stale listing detection
5. **Cross-Listing** -- Assisted templates for Poshmark, Mercari, Depop with copy-paste UI
6. **Orders and Sales** -- Order tracking, profit calculation (fees, shipping, COGS), manual sale recording
7. **Analytics Dashboard** -- Revenue charts, channel performance, top items, CSV export
8. **Delist-on-Sale** -- Automatic cross-platform delisting when an item sells
9. **Audit and Undo** -- Full audit trail for automated actions with one-click undo
10. **Storage Tracking** -- Bin/shelf location tracking, ship-ready status, sold-item location alerts

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone <repo-url> reselleros
cd reselleros

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# Run database migrations
npm run db:migrate

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite file path or Turso URL |
| `TURSO_AUTH_TOKEN` | For Turso | Auth token for Turso cloud DB |
| `NEXTAUTH_SECRET` | Yes | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | App URL (http://localhost:3000 for dev) |
| `EBAY_CLIENT_ID` | Yes | eBay Developer app credentials |
| `EBAY_CLIENT_SECRET` | Yes | eBay Developer app credentials |
| `EBAY_REDIRECT_URI` | Yes | OAuth callback URL |
| `EBAY_ENVIRONMENT` | Yes | `sandbox` or `production` |
| `OPENAI_API_KEY` | Yes | For AI listing generation |
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 credentials |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2 credentials |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2 credentials |
| `R2_BUCKET_NAME` | Yes | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | Public URL for R2 bucket |
| `INNGEST_EVENT_KEY` | Yes | Inngest credentials |
| `INNGEST_SIGNING_KEY` | Yes | Inngest credentials |

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run inngest:dev` | Start Inngest dev server |

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    (auth)/               # Login, OAuth callbacks
    (dashboard)/          # Protected routes
      inventory/          # Inventory management
      listings/           # Listing creation and editing
      orders/             # Order tracking
      analytics/          # Profit reports and charts
      settings/           # User and autopilot config
    api/
      trpc/               # tRPC endpoint
      webhooks/           # eBay webhooks
      inngest/            # Background job endpoint
  server/
    db/                   # Schema, client, migrations
    trpc/                 # tRPC routers (inventory, listings, orders, etc.)
    services/             # Business logic
      ai/                 # OpenAI listing generation
      channels/           # eBay native + assisted adapters
      autopilot/          # Rules engine, confidence scoring
      audit/              # Audit logging and undo
      storage/            # R2 image storage
    jobs/                 # Inngest background functions
  components/             # React components (ui/, inventory/, listings/, dashboard/)
  lib/                    # Shared utilities, types, constants
```

## Deployment

The app is deployed on Vercel with Turso as the production database. Inngest Cloud handles background job execution.

For production deployment:

1. Push to the `main` branch (Vercel auto-deploys)
2. Set all environment variables in Vercel project settings
3. Ensure Turso database is provisioned and migrations are applied
4. Configure Inngest Cloud with the Vercel deployment URL
5. Set up eBay Developer Portal webhooks pointing to your domain

## License

Proprietary. All rights reserved.
