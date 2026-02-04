# ResellerOS - System Architecture

> This document defines the technical architecture and system design.
> Created: 2026-02-03 (Phase 3 - Architecture)
> Owner: planner, implementer

---

## 1. System Overview

ResellerOS is a **modular monolith, local-first** application designed for solo resellers managing 50-2000 listings across multiple marketplaces. The architecture prioritizes:

1. **Developer velocity** - Solo-friendly stack, minimal ops overhead
2. **Type safety** - End-to-end TypeScript with tRPC
3. **Reliability** - Event-driven jobs with retry, audit trails, undo capability
4. **Cost efficiency** - SQLite local-first, Cloudflare R2 free egress

### Core Capabilities

| Capability | Implementation |
|------------|----------------|
| AI Listing Generation | GPT-4o multimodal (photos to listing) |
| eBay Publishing | Native Inventory API integration |
| Cross-List Assist | Template generation for Poshmark/Mercari |
| Auto-Delist on Sale | Webhook + polling, < 30 second target |
| Smart Repricing | Time-decay, performance-based rules |
| Profit Tracking | Real fee calculation via Finances API |

---

## 2. High-Level System Diagram

```
+------------------------------------------------------------------+
|                         ResellerOS                                |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+    +-----------------------------+   |
|  |     Next.js Web App    |    |      Background Jobs        |   |
|  |  (Dashboard, Listings) |    |        (Inngest)            |   |
|  +------------------------+    +-----------------------------+   |
|           |                              |                       |
|           v                              v                       |
|  +--------------------------------------------------+            |
|  |              tRPC API Layer                       |            |
|  |  (Type-safe procedures, validation, auth)         |            |
|  +--------------------------------------------------+            |
|           |                              |                       |
|           v                              v                       |
|  +------------------+    +---------------------------+           |
|  |  SQLite + Drizzle|    |    Service Layer          |           |
|  |   (Local-first)  |    | +---------------------+   |           |
|  +------------------+    | | Autopilot Engine    |   |           |
|           |              | | (Rules, Confidence) |   |           |
|           v              | +---------------------+   |           |
|  +------------------+    | +---------------------+   |           |
|  | Turso (Optional) |    | | Channel Adapters    |   |           |
|  | (Edge sync)      |    | | (eBay, Poshmark,    |   |           |
|  +------------------+    | |  Mercari)           |   |           |
|                          | +---------------------+   |           |
|                          | +---------------------+   |           |
|                          | | AI Service          |   |           |
|                          | | (GPT-4o)            |   |           |
|                          | +---------------------+   |           |
|                          +---------------------------+           |
|                                                                  |
+------------------------------------------------------------------+
           |                    |                    |
           v                    v                    v
+------------------+  +------------------+  +------------------+
|   eBay APIs      |  |  OpenAI API      |  | Cloudflare R2    |
| (Inventory,      |  |  (GPT-4o,        |  | (Image Storage)  |
|  Fulfillment,    |  |   Vision)        |  |                  |
|  Notifications)  |  |                  |  |                  |
+------------------+  +------------------+  +------------------+
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14 (App Router) | Full-stack framework, SSR, excellent DX, solo-developer friendly |
| **API** | tRPC | End-to-end type safety, integrates natively with Next.js |
| **Database** | SQLite + Drizzle ORM | Local-first, zero config, embeddable, < 2000 listings fits easily |
| **Cloud DB** | Turso (optional) | SQLite-compatible, edge-ready, for multi-device sync |
| **Background Jobs** | Inngest | Event-driven, serverless-friendly, built-in retry/scheduling |
| **AI** | OpenAI GPT-4o / GPT-4o-mini | Best multimodal capabilities, cost-effective for listing generation |
| **Image Storage** | Cloudflare R2 | S3-compatible, FREE egress, $0.015/GB storage |
| **Auth** | NextAuth.js | Simple OAuth2 integration, supports eBay OAuth |
| **Hosting** | Vercel (web) + Inngest Cloud | Zero-ops deployment, automatic scaling |
| **Monitoring** | Vercel Analytics + Sentry | Error tracking, performance monitoring |

### Why This Stack?

1. **SQLite over Postgres**: Target users have < 2000 listings. SQLite is simpler, faster for single-user, and Turso enables edge sync if needed later.

2. **tRPC over REST**: Eliminates API contract drift. Full TypeScript inference from backend to frontend.

3. **Inngest over BullMQ**: Serverless-native, no Redis to manage, built-in retry logic, perfect for Vercel deployment.

4. **R2 over S3**: Identical API, free egress saves significant cost for image-heavy application.

---

## 4. Component Architecture

### Directory Structure

```
reselleros/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── (auth)/               # Auth routes (login, callback)
│   │   ├── (dashboard)/          # Protected dashboard routes
│   │   │   ├── inventory/        # Inventory management
│   │   │   ├── listings/         # Listing creation/editing
│   │   │   ├── orders/           # Order management
│   │   │   ├── analytics/        # Profit tracking, reports
│   │   │   └── settings/         # User settings, rules
│   │   ├── api/                  # API routes
│   │   │   ├── trpc/             # tRPC endpoint
│   │   │   ├── webhooks/         # eBay webhooks
│   │   │   └── inngest/          # Inngest endpoint
│   │   └── layout.tsx
│   │
│   ├── server/                   # Backend code
│   │   ├── db/                   # Database layer
│   │   │   ├── schema.ts         # Drizzle schema definitions
│   │   │   ├── client.ts         # Database client
│   │   │   └── migrations/       # SQL migrations
│   │   │
│   │   ├── trpc/                 # tRPC setup
│   │   │   ├── root.ts           # Root router
│   │   │   ├── context.ts        # Request context
│   │   │   └── routers/          # Domain routers
│   │   │       ├── inventory.ts
│   │   │       ├── listings.ts
│   │   │       ├── orders.ts
│   │   │       ├── channels.ts
│   │   │       ├── autopilot.ts
│   │   │       └── analytics.ts
│   │   │
│   │   ├── services/             # Business logic
│   │   │   ├── ai/               # AI service
│   │   │   │   ├── listing-generator.ts
│   │   │   │   ├── price-suggester.ts
│   │   │   │   └── prompts/
│   │   │   │
│   │   │   ├── channels/         # Channel adapters
│   │   │   │   ├── adapter.ts    # Base adapter interface
│   │   │   │   ├── ebay/         # eBay native integration
│   │   │   │   ├── poshmark/     # Poshmark assisted
│   │   │   │   └── mercari/      # Mercari assisted
│   │   │   │
│   │   │   ├── autopilot/        # Automation engine
│   │   │   │   ├── engine.ts     # Core autopilot logic
│   │   │   │   ├── rules/        # Rule implementations
│   │   │   │   ├── confidence.ts # Confidence scoring
│   │   │   │   └── rate-limiter.ts
│   │   │   │
│   │   │   ├── audit/            # Audit & undo system
│   │   │   │   ├── logger.ts
│   │   │   │   └── undo.ts
│   │   │   │
│   │   │   └── storage/          # Image storage
│   │   │       └── r2.ts
│   │   │
│   │   └── jobs/                 # Inngest job definitions
│   │       ├── delist-on-sale.ts
│   │       ├── reprice-check.ts
│   │       ├── stale-inventory.ts
│   │       ├── offer-handler.ts
│   │       └── sync-orders.ts
│   │
│   ├── lib/                      # Shared utilities
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   └── types.ts
│   │
│   └── components/               # React components
│       ├── ui/                   # Base UI components
│       ├── inventory/            # Inventory-specific
│       ├── listings/             # Listing-specific
│       └── dashboard/            # Dashboard widgets
│
├── drizzle.config.ts             # Drizzle configuration
├── inngest.config.ts             # Inngest configuration
└── next.config.js                # Next.js configuration
```

---

## 5. Core Service Interfaces

### 5.1 Channel Adapter Interface

```typescript
// src/server/services/channels/adapter.ts

export type ChannelId = 'ebay' | 'poshmark' | 'mercari' | 'depop';

export type IntegrationMode = 'native' | 'assisted' | 'manual';

export interface ChannelCapabilities {
  canPublish: boolean;
  canReprice: boolean;
  canDelist: boolean;
  canSyncOrders: boolean;
  canSyncInventory: boolean;
  requiresManualAction: boolean;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
  requiresManualAction?: boolean;
  manualInstructions?: string;
}

export interface DelistResult {
  success: boolean;
  error?: string;
  requiresManualAction?: boolean;
}

export interface ChannelAdapter {
  readonly channelId: ChannelId;
  readonly mode: IntegrationMode;
  readonly capabilities: ChannelCapabilities;

  // Authentication
  isConnected(userId: string): Promise<boolean>;
  getAuthUrl(userId: string): Promise<string>;
  handleCallback(userId: string, code: string): Promise<void>;
  refreshToken(userId: string): Promise<void>;

  // Listing Operations
  publish(userId: string, listing: ListingData): Promise<PublishResult>;
  update(userId: string, externalId: string, updates: Partial<ListingData>): Promise<PublishResult>;
  delist(userId: string, externalId: string): Promise<DelistResult>;

  // Sync Operations (if supported)
  syncOrders?(userId: string, since: Date): Promise<Order[]>;
  syncInventory?(userId: string): Promise<InventoryItem[]>;

  // Assisted Mode Helpers
  generateTemplate?(listing: ListingData): CrossListTemplate;
}

export interface ListingData {
  title: string;
  description: string;
  price: number;
  quantity: number;
  condition: ItemCondition;
  category?: string;
  imageUrls: string[];
  itemSpecifics?: Record<string, string>;
  sku: string;
}

export interface CrossListTemplate {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
}
```

### 5.2 Autopilot Engine Interface

```typescript
// src/server/services/autopilot/engine.ts

export type ActionType =
  | 'OFFER_ACCEPT'
  | 'OFFER_DECLINE'
  | 'OFFER_COUNTER'
  | 'REPRICE'
  | 'DELIST'
  | 'RELIST'
  | 'ARCHIVE';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export interface AutopilotAction {
  id: string;
  type: ActionType;
  itemId: string;
  userId: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  createdAt: Date;
}

export interface ActionResult {
  success: boolean;
  actionId: string;
  error?: string;
  undoAvailable: boolean;
  undoDeadline?: Date;
}

export interface AutopilotEngine {
  // Rule Evaluation
  evaluateOffer(offer: OfferEvent, rules: OfferRules): Promise<AutopilotAction>;
  evaluateReprice(item: InventoryItem, rules: RepriceRules): Promise<AutopilotAction | null>;
  evaluateStale(item: InventoryItem, rules: StaleRules): Promise<AutopilotAction | null>;

  // Action Execution
  executeAction(action: AutopilotAction): Promise<ActionResult>;
  queueForApproval(action: AutopilotAction): Promise<void>;

  // Undo System
  undoAction(actionId: string, userId: string): Promise<ActionResult>;
  getUndoableActions(userId: string): Promise<AutopilotAction[]>;

  // Rate Limiting
  checkRateLimit(userId: string, actionType: ActionType): Promise<boolean>;
  getRateLimitStatus(userId: string): Promise<RateLimitStatus>;
}

export interface OfferRules {
  autoAcceptThreshold: number;     // 0.0 - 1.0 (default: 0.90)
  autoDeclineThreshold: number;    // 0.0 - 1.0 (default: 0.50)
  autoCounterEnabled: boolean;
  counterStrategy: 'floor' | 'midpoint' | 'asking-5%';
  maxCounterRounds: number;
  requireFloor: boolean;
  highValueThreshold: number;      // Items above require manual review
}

export interface RepriceRules {
  strategy: 'time_decay' | 'performance' | 'competitive';
  enabled: boolean;
  maxDailyDrop: number;            // 0.0 - 1.0 (default: 0.10)
  maxWeeklyDrop: number;           // 0.0 - 1.0 (default: 0.20)
  highValueThreshold: number;
}
```

### 5.3 AI Service Interface

```typescript
// src/server/services/ai/listing-generator.ts

export interface GenerateListingInput {
  images: string[];                // URLs or base64
  userHints?: {
    category?: string;
    brand?: string;
    condition?: string;
    keywords?: string[];
  };
  targetPlatform: ChannelId;
}

export interface GeneratedListing {
  title: string;
  description: string;
  suggestedPrice: {
    min: number;
    max: number;
    recommended: number;
  };
  category: {
    suggested: string;
    confidence: number;
  };
  condition: {
    suggested: ItemCondition;
    confidence: number;
  };
  itemSpecifics: Array<{
    name: string;
    value: string;
    confidence: number;
  }>;
  confidence: number;
  tokensUsed: number;
  model: string;
}

export interface AIService {
  generateListing(input: GenerateListingInput): Promise<GeneratedListing>;
  suggestPrice(item: InventoryItem, comps?: CompItem[]): Promise<PriceSuggestion>;
  improveTitle(currentTitle: string, category: string): Promise<string>;
  improveDescription(currentDesc: string, category: string): Promise<string>;
}
```

### 5.4 Audit Service Interface

```typescript
// src/server/services/audit/logger.ts

export interface AuditEntry {
  id: string;
  actionId: string;
  actionType: ActionType;
  timestamp: Date;
  userId: string;
  itemId: string;
  platform: ChannelId;
  ruleId?: string;
  confidence: number;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  reversible: boolean;
  reversed: boolean;
  reversedAt?: Date;
  source: 'AUTOPILOT' | 'USER' | 'SYSTEM';
  metadata?: Record<string, unknown>;
}

export interface AuditService {
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry>;
  getByActionId(actionId: string): Promise<AuditEntry | null>;
  getByUserId(userId: string, options: QueryOptions): Promise<AuditEntry[]>;
  getReversibleActions(userId: string): Promise<AuditEntry[]>;
  markReversed(actionId: string): Promise<void>;
}
```

---

## 6. Channel Adapter Pattern Design

### 6.1 Adapter Implementation Strategy

```
                    ChannelAdapter (Interface)
                           |
          +----------------+----------------+
          |                |                |
     EbayAdapter     PoshmarkAdapter   MercariAdapter
     (Native)        (Assisted)        (Assisted)
          |                |                |
          v                v                v
    eBay REST API    Template Gen      Template Gen
    (Full control)   + Manual Track    + Import Guide
```

### 6.2 eBay Native Adapter

```typescript
// src/server/services/channels/ebay/adapter.ts

export class EbayAdapter implements ChannelAdapter {
  readonly channelId = 'ebay' as const;
  readonly mode = 'native' as const;
  readonly capabilities: ChannelCapabilities = {
    canPublish: true,
    canReprice: true,
    canDelist: true,
    canSyncOrders: true,
    canSyncInventory: true,
    requiresManualAction: false,
  };

  private rateLimiter: RateLimiter;

  constructor(private config: EbayConfig) {
    // 200 safe limit out of 250 daily revisions
    this.rateLimiter = new RateLimiter({
      maxRevisions: 200,
      resetAt: 'midnight_pt',
    });
  }

  async publish(userId: string, listing: ListingData): Promise<PublishResult> {
    const token = await this.getToken(userId);

    // 1. Create inventory item
    const inventoryResult = await this.createInventoryItem(token, listing);
    if (!inventoryResult.success) {
      return { success: false, error: inventoryResult.error };
    }

    // 2. Create and publish offer
    const offerResult = await this.createAndPublishOffer(token, listing.sku);
    if (!offerResult.success) {
      return { success: false, error: offerResult.error };
    }

    return {
      success: true,
      externalId: offerResult.listingId,
      externalUrl: `https://ebay.com/itm/${offerResult.listingId}`,
    };
  }

  async delist(userId: string, externalId: string): Promise<DelistResult> {
    const token = await this.getToken(userId);

    // Set quantity to 0 (fastest method)
    const result = await this.updateQuantity(token, externalId, 0);

    return {
      success: result.success,
      error: result.error,
    };
  }

  async syncOrders(userId: string, since: Date): Promise<Order[]> {
    const token = await this.getToken(userId);
    return this.fetchOrders(token, since);
  }
}
```

### 6.3 Poshmark Assisted Adapter

```typescript
// src/server/services/channels/poshmark/adapter.ts

export class PoshmarkAdapter implements ChannelAdapter {
  readonly channelId = 'poshmark' as const;
  readonly mode = 'assisted' as const;
  readonly capabilities: ChannelCapabilities = {
    canPublish: false,        // User must list manually
    canReprice: false,        // User must update manually
    canDelist: false,         // User must delist manually
    canSyncOrders: false,     // User reports sales
    canSyncInventory: false,
    requiresManualAction: true,
  };

  async publish(userId: string, listing: ListingData): Promise<PublishResult> {
    // Generate template for user to copy
    const template = this.generateTemplate(listing);

    return {
      success: true,
      requiresManualAction: true,
      manualInstructions: [
        '1. Open Poshmark app or poshmark.com',
        '2. Tap "Sell" to create new listing',
        '3. Upload photos from your device',
        '4. Copy the title and description below',
        '5. Set the price and complete listing',
      ].join('\n'),
    };
  }

  generateTemplate(listing: ListingData): CrossListTemplate {
    // Poshmark has 80 char title limit, different description format
    const poshTitle = this.optimizeForPoshmark(listing.title);
    const poshDesc = this.formatPoshmarkDescription(listing.description);

    return {
      title: poshTitle,
      description: poshDesc,
      price: listing.price,
      copyableFields: {
        title: poshTitle,
        description: poshDesc,
        size: listing.itemSpecifics?.size || '',
        brand: listing.itemSpecifics?.brand || '',
      },
      instructions: [
        'Copy each field below into your Poshmark listing',
        'Add relevant Poshmark-specific tags',
        'Enable "My Size" for better visibility',
      ],
    };
  }

  async delist(userId: string, externalId: string): Promise<DelistResult> {
    // Cannot auto-delist - notify user
    return {
      success: false,
      requiresManualAction: true,
      error: 'Please manually delist this item on Poshmark',
    };
  }
}
```

---

## 7. Data Models (Drizzle Schema)

```typescript
// src/server/db/schema.ts

import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============ USERS ============

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),

  // Subscription
  tier: text('tier', { enum: ['free', 'starter', 'pro', 'power', 'business'] })
    .notNull()
    .default('free'),
  tierExpiresAt: integer('tier_expires_at', { mode: 'timestamp' }),

  // Limits (current period)
  listingsThisMonth: integer('listings_this_month').notNull().default(0),
  bgRemovalsThisMonth: integer('bg_removals_this_month').notNull().default(0),
  periodResetAt: integer('period_reset_at', { mode: 'timestamp' }),
});

// ============ CHANNEL CONNECTIONS ============

export const channelConnections = sqliteTable('channel_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  channel: text('channel', { enum: ['ebay', 'poshmark', 'mercari', 'depop'] }).notNull(),

  // OAuth tokens (encrypted)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),

  // Channel-specific data
  externalUserId: text('external_user_id'),
  externalUsername: text('external_username'),

  // Status
  status: text('status', { enum: ['active', 'expired', 'revoked'] }).notNull(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ INVENTORY ============

export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sku: text('sku').notNull(),

  // Core fields
  title: text('title').notNull(),
  description: text('description').notNull(),
  condition: text('condition', {
    enum: ['new', 'like_new', 'good', 'fair', 'poor']
  }).notNull(),

  // Pricing
  askingPrice: real('asking_price').notNull(),
  floorPrice: real('floor_price'),
  costBasis: real('cost_basis'),           // What user paid (COGS)

  // Status
  status: text('status', {
    enum: ['draft', 'active', 'sold', 'shipped', 'archived']
  }).notNull().default('draft'),
  quantity: integer('quantity').notNull().default(1),

  // AI-generated data
  aiConfidence: real('ai_confidence'),
  suggestedCategory: text('suggested_category'),
  itemSpecifics: text('item_specifics', { mode: 'json' }),  // JSON object

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  listedAt: integer('listed_at', { mode: 'timestamp' }),
  soldAt: integer('sold_at', { mode: 'timestamp' }),
});

// ============ IMAGES ============

export const itemImages = sqliteTable('item_images', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => inventoryItems.id),

  // Storage
  originalUrl: text('original_url').notNull(),      // R2 URL
  processedUrl: text('processed_url'),              // After BG removal

  // Metadata
  position: integer('position').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  sizeBytes: integer('size_bytes'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ CHANNEL LISTINGS ============

export const channelListings = sqliteTable('channel_listings', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => inventoryItems.id),
  channel: text('channel', { enum: ['ebay', 'poshmark', 'mercari', 'depop'] }).notNull(),

  // External reference
  externalId: text('external_id'),                  // Platform listing ID
  externalUrl: text('external_url'),

  // Channel-specific pricing (may differ from inventory)
  price: real('price').notNull(),

  // Status
  status: text('status', {
    enum: ['draft', 'pending', 'active', 'ended', 'sold', 'error']
  }).notNull(),
  statusMessage: text('status_message'),

  // For assisted channels
  requiresManualAction: integer('requires_manual_action', { mode: 'boolean' })
    .notNull()
    .default(false),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
});

// ============ ORDERS ============

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  itemId: text('item_id').notNull().references(() => inventoryItems.id),
  channelListingId: text('channel_listing_id').references(() => channelListings.id),

  // Order details
  channel: text('channel', { enum: ['ebay', 'poshmark', 'mercari', 'depop'] }).notNull(),
  externalOrderId: text('external_order_id'),

  // Financials
  salePrice: real('sale_price').notNull(),
  shippingPaid: real('shipping_paid'),
  platformFees: real('platform_fees'),
  shippingCost: real('shipping_cost'),
  netProfit: real('net_profit'),                    // Calculated

  // Buyer info (minimal for privacy)
  buyerUsername: text('buyer_username'),
  shippingAddress: text('shipping_address', { mode: 'json' }),

  // Status
  status: text('status', {
    enum: ['pending', 'paid', 'shipped', 'delivered', 'returned', 'cancelled']
  }).notNull(),

  // Timestamps
  orderedAt: integer('ordered_at', { mode: 'timestamp' }).notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  shippedAt: integer('shipped_at', { mode: 'timestamp' }),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
});

// ============ AUTOPILOT ============

export const autopilotRules = sqliteTable('autopilot_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),

  // Rule type
  ruleType: text('rule_type', {
    enum: ['offer', 'reprice', 'stale', 'delist']
  }).notNull(),

  // Configuration (JSON based on rule type)
  config: text('config', { mode: 'json' }).notNull(),

  // Status
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const autopilotActions = sqliteTable('autopilot_actions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  itemId: text('item_id').references(() => inventoryItems.id),
  ruleId: text('rule_id').references(() => autopilotRules.id),

  // Action details
  actionType: text('action_type', {
    enum: ['OFFER_ACCEPT', 'OFFER_DECLINE', 'OFFER_COUNTER', 'REPRICE', 'DELIST', 'RELIST', 'ARCHIVE']
  }).notNull(),

  // Confidence
  confidence: real('confidence').notNull(),
  confidenceLevel: text('confidence_level', {
    enum: ['HIGH', 'MEDIUM', 'LOW', 'VERY_LOW']
  }).notNull(),

  // State tracking
  beforeState: text('before_state', { mode: 'json' }),
  afterState: text('after_state', { mode: 'json' }),
  payload: text('payload', { mode: 'json' }),

  // Execution
  status: text('status', {
    enum: ['pending', 'approved', 'executed', 'failed', 'rejected', 'undone']
  }).notNull(),
  requiresApproval: integer('requires_approval', { mode: 'boolean' }).notNull(),

  // Undo capability
  reversible: integer('reversible', { mode: 'boolean' }).notNull(),
  undoDeadline: integer('undo_deadline', { mode: 'timestamp' }),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  executedAt: integer('executed_at', { mode: 'timestamp' }),
  undoneAt: integer('undone_at', { mode: 'timestamp' }),

  // Error tracking
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
});

// ============ AUDIT LOG ============

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),

  // What happened
  actionType: text('action_type').notNull(),
  actionId: text('action_id'),                      // Links to autopilotActions if automated
  itemId: text('item_id'),
  channel: text('channel'),

  // State change
  beforeState: text('before_state', { mode: 'json' }),
  afterState: text('after_state', { mode: 'json' }),

  // Source
  source: text('source', { enum: ['AUTOPILOT', 'USER', 'SYSTEM', 'WEBHOOK'] }).notNull(),

  // Metadata
  metadata: text('metadata', { mode: 'json' }),

  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ many }) => ({
  channelConnections: many(channelConnections),
  inventoryItems: many(inventoryItems),
  orders: many(orders),
  autopilotRules: many(autopilotRules),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  user: one(users, {
    fields: [inventoryItems.userId],
    references: [users.id],
  }),
  images: many(itemImages),
  channelListings: many(channelListings),
  orders: many(orders),
}));

export const channelListingsRelations = relations(channelListings, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [channelListings.itemId],
    references: [inventoryItems.id],
  }),
}));

export const itemImagesRelations = relations(itemImages, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [itemImages.itemId],
    references: [inventoryItems.id],
  }),
}));

export const channelConnectionsRelations = relations(channelConnections, ({ one }) => ({
  user: one(users, {
    fields: [channelConnections.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  item: one(inventoryItems, {
    fields: [orders.itemId],
    references: [inventoryItems.id],
  }),
  channelListing: one(channelListings, {
    fields: [orders.channelListingId],
    references: [channelListings.id],
  }),
}));

export const autopilotRulesRelations = relations(autopilotRules, ({ one, many }) => ({
  user: one(users, {
    fields: [autopilotRules.userId],
    references: [users.id],
  }),
  actions: many(autopilotActions),
}));

export const autopilotActionsRelations = relations(autopilotActions, ({ one }) => ({
  user: one(users, {
    fields: [autopilotActions.userId],
    references: [users.id],
  }),
  item: one(inventoryItems, {
    fields: [autopilotActions.itemId],
    references: [inventoryItems.id],
  }),
  rule: one(autopilotRules, {
    fields: [autopilotActions.ruleId],
    references: [autopilotRules.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));
```

### 7.2 Indexes

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| inventoryItems | userId | User inventory lookups |
| inventoryItems | status | Status filtering |
| inventoryItems | (userId, status) | Dashboard queries |
| channelListings | itemId | Item channel lookup |
| channelListings | (channel, status) | Channel dashboard |
| orders | userId | User order history |
| orders | orderedAt | Date range reports |
| autopilotActions | (status, createdAt) | Pending actions queue |
| auditLog | (userId, timestamp) | User audit history |

### 7.3 JSON Field Structures

**inventoryItems.itemSpecifics**
```typescript
interface ItemSpecifics {
  brand?: string;
  size?: string;
  color?: string;
  material?: string;
  [key: string]: string | undefined;
}
```

**autopilotRules.config** (varies by ruleType)
```typescript
// ruleType = 'offer'
interface OfferRuleConfig {
  autoAcceptThreshold: number;    // 0.90 = 90% of asking
  autoDeclineThreshold: number;   // 0.50 = 50% of asking
  autoCounterEnabled: boolean;
  counterStrategy: 'floor' | 'midpoint' | 'asking-5%';
  highValueThreshold: number;
}

// ruleType = 'reprice'
interface RepriceRuleConfig {
  strategy: 'time_decay' | 'performance';
  maxDailyDropPercent: number;
  respectFloorPrice: boolean;
}
```

---

## 8. Autopilot Engine Design

### 8.1 Event Flow

```
+------------------+     +------------------+     +------------------+
|   Event Source   | --> |  Inngest Queue   | --> | Autopilot Engine |
+------------------+     +------------------+     +------------------+
                                                         |
        +------------------------+------------------------+
        |                        |                        |
        v                        v                        v
+---------------+       +----------------+       +---------------+
| Rule Matcher  |       | Confidence     |       | Rate Limiter  |
| (find rules)  |       | Calculator     |       | (check quota) |
+---------------+       +----------------+       +---------------+
        |                        |                        |
        +------------------------+------------------------+
                                 |
                                 v
                    +-------------------------+
                    | Action Decision         |
                    | - Execute immediately   |
                    | - Queue for approval    |
                    | - Block (low confidence)|
                    +-------------------------+
                                 |
        +------------------------+------------------------+
        |                        |                        |
        v                        v                        v
+---------------+       +----------------+       +---------------+
| Execute       |       | Notify User    |       | Log to Audit  |
| (via adapter) |       | (if needed)    |       |               |
+---------------+       +----------------+       +---------------+
```

### 8.2 Confidence Scoring

```typescript
// src/server/services/autopilot/confidence.ts

export function calculateConfidence(context: ConfidenceContext): number {
  let score = 1.0;

  // Item value penalty (higher value = lower confidence)
  if (context.itemValue > 200) {
    score *= 0.6;  // High-value items get 40% penalty
  } else if (context.itemValue > 100) {
    score *= 0.8;  // Medium-value items get 20% penalty
  }

  // Pattern match quality
  score *= context.patternMatchQuality;  // 0.0 - 1.0

  // Historical accuracy
  if (context.ruleHistoricalAccuracy !== undefined) {
    score *= context.ruleHistoricalAccuracy;  // 0.0 - 1.0
  }

  // Time since last user activity (decay)
  const hoursSinceActive = context.hoursSinceLastActivity;
  if (hoursSinceActive > 24) {
    score *= 0.9;  // 10% penalty if user inactive > 24h
  }

  // First-time rule execution
  if (context.isFirstExecution) {
    score *= 0.7;  // 30% penalty for first execution
  }

  return Math.max(0, Math.min(1, score));  // Clamp to 0-1
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.90) return 'HIGH';
  if (score >= 0.70) return 'MEDIUM';
  if (score >= 0.50) return 'LOW';
  return 'VERY_LOW';
}

export function shouldExecute(level: ConfidenceLevel): boolean {
  return level === 'HIGH' || level === 'MEDIUM';
}

export function requiresApproval(level: ConfidenceLevel): boolean {
  return level === 'LOW';
}
```

### 8.3 Rate Limiting

```typescript
// src/server/services/autopilot/rate-limiter.ts

interface RateLimits {
  ebayRevisions: { daily: 200, current: number, resetsAt: Date };
  reprices: { daily: 100, current: number, resetsAt: Date };
  autoAccepts: { daily: 50, current: number, resetsAt: Date };
  autoCounters: { daily: 100, current: number, resetsAt: Date };
  relists: { daily: 25, current: number, resetsAt: Date };
}

export class RateLimiter {
  async checkLimit(userId: string, limitType: keyof RateLimits): Promise<{
    allowed: boolean;
    remaining: number;
    resetsAt: Date;
    percentUsed: number;
  }> {
    const limits = await this.getLimits(userId);
    const limit = limits[limitType];

    const allowed = limit.current < limit.daily;
    const remaining = Math.max(0, limit.daily - limit.current);
    const percentUsed = (limit.current / limit.daily) * 100;

    return { allowed, remaining, resetsAt: limit.resetsAt, percentUsed };
  }

  async incrementLimit(userId: string, limitType: keyof RateLimits): Promise<void> {
    // Atomic increment in database
    await db.update(userLimits)
      .set({ [limitType]: sql`${limitType} + 1` })
      .where(eq(userLimits.userId, userId));
  }

  async shouldWarn(userId: string, limitType: keyof RateLimits): Promise<boolean> {
    const status = await this.checkLimit(userId, limitType);
    return status.percentUsed >= 80;  // Warn at 80%
  }
}
```

### 8.4 Delist-on-Sale Job

```typescript
// src/server/jobs/delist-on-sale.ts

import { inngest } from '@/inngest/client';

export const delistOnSale = inngest.createFunction(
  {
    id: 'delist-on-sale',
    retries: 3,
    onFailure: async ({ error, event }) => {
      // CRITICAL: Alert user immediately
      await sendCriticalAlert(event.data.userId, {
        type: 'DELIST_FAILED',
        itemId: event.data.itemId,
        error: error.message,
        manualAction: 'Please manually delist on other platforms',
      });
    },
  },
  { event: 'order/confirmed' },
  async ({ event, step }) => {
    const { itemId, userId, soldOnChannel } = event.data;

    // Step 1: Get all channel listings for this item
    const listings = await step.run('get-listings', async () => {
      return db.query.channelListings.findMany({
        where: and(
          eq(channelListings.itemId, itemId),
          eq(channelListings.status, 'active'),
          ne(channelListings.channel, soldOnChannel),
        ),
      });
    });

    // Step 2: Delist from each channel (parallel with individual retry)
    const results = await Promise.allSettled(
      listings.map(listing =>
        step.run(`delist-${listing.channel}`, async () => {
          const adapter = getAdapter(listing.channel);

          if (adapter.capabilities.canDelist) {
            // Native delist
            return adapter.delist(userId, listing.externalId!);
          } else {
            // Assisted - notify user
            await notifyUser(userId, {
              type: 'MANUAL_DELIST_REQUIRED',
              channel: listing.channel,
              itemTitle: event.data.itemTitle,
            });
            return { success: true, requiresManualAction: true };
          }
        })
      )
    );

    // Step 3: Update inventory status
    await step.run('update-inventory', async () => {
      await db.update(inventoryItems)
        .set({ status: 'sold', quantity: 0, soldAt: new Date() })
        .where(eq(inventoryItems.id, itemId));
    });

    // Step 4: Log to audit
    await step.run('audit-log', async () => {
      await auditService.log({
        userId,
        actionType: 'DELIST_ON_SALE',
        itemId,
        source: 'SYSTEM',
        afterState: { status: 'sold', delistedChannels: listings.map(l => l.channel) },
      });
    });

    // Return summary
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      throw new Error(`Failed to delist from ${failures.length} channel(s)`);
    }

    return { success: true, delistedCount: listings.length };
  }
);
```

---

## 9. Data Flow Diagrams

### 9.1 Listing Creation Flow

```
User uploads photos
       |
       v
+------------------+
| Upload to R2     |
| (presigned URL)  |
+------------------+
       |
       v
+------------------+
| AI Service       |
| - Analyze images |
| - Generate title |
| - Generate desc  |
| - Suggest price  |
| - Suggest category|
+------------------+
       |
       v
+------------------+
| User Review      |
| - Confirm/edit   |
| - Set floor price|
| - Select channels|
+------------------+
       |
       v
+------------------+
| Create Inventory |
| Item in DB       |
+------------------+
       |
       v
+-------------------+------------------+
|                   |                  |
v                   v                  v
eBay               Poshmark           Mercari
(Native)           (Assisted)         (Assisted)
|                   |                  |
v                   v                  v
Inventory API      Generate           Generate
 -> Publish         Template           Template
|                   |                  |
v                   v                  v
Return             Show copy-         Show copy-
listing URL        paste UI           paste UI
```

### 9.2 Sale and Delist Flow

```
Sale Event Detected
(Webhook or Poll)
       |
       v
+------------------+
| Inngest Event:   |
| order/confirmed  |
+------------------+
       |
       v
+------------------+
| Delist Job       |
| (3 retries)      |
+------------------+
       |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
  Other eBay          Poshmark            Mercari
  listings            listing             listing
       |                  |                  |
       v                  v                  v
  API: qty=0          Notify user        Notify user
  (< 30 sec)          to delist          to delist
       |                  |                  |
       +------------------+------------------+
                          |
                          v
              +------------------+
              | Update Inventory |
              | status: SOLD     |
              +------------------+
                          |
                          v
              +------------------+
              | Calculate Profit |
              | (fees from API)  |
              +------------------+
                          |
                          v
              +------------------+
              | Audit Log Entry  |
              +------------------+
```

---

## 10. Deployment Architecture

```
                    +------------------+
                    |   Cloudflare     |
                    |   (CDN + WAF)    |
                    +------------------+
                            |
                            v
                    +------------------+
                    |     Vercel       |
                    | +------------+   |
                    | | Next.js    |   |
                    | | App        |   |
                    | +------------+   |
                    | +------------+   |
                    | | API Routes |   |
                    | | (tRPC)     |   |
                    | +------------+   |
                    +------------------+
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
    +-------------+  +-------------+  +-------------+
    | SQLite/Turso|  | Inngest     |  | Cloudflare  |
    | (Database)  |  | Cloud       |  | R2          |
    |             |  | (Jobs)      |  | (Images)    |
    +-------------+  +-------------+  +-------------+
```

### Environment Configuration

```typescript
// Environment variables
interface EnvConfig {
  // Database
  DATABASE_URL: string;           // Local SQLite or Turso URL
  TURSO_AUTH_TOKEN?: string;      // If using Turso

  // Auth
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;

  // eBay
  EBAY_CLIENT_ID: string;
  EBAY_CLIENT_SECRET: string;
  EBAY_REDIRECT_URI: string;
  EBAY_ENVIRONMENT: 'sandbox' | 'production';

  // OpenAI
  OPENAI_API_KEY: string;

  // Cloudflare R2
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;

  // Inngest
  INNGEST_EVENT_KEY: string;
  INNGEST_SIGNING_KEY: string;

  // Optional
  SENTRY_DSN?: string;
}
```

---

## 11. Security Considerations

### 11.1 Authentication and Authorization

| Concern | Solution |
|---------|----------|
| User authentication | NextAuth.js with OAuth (eBay, Google) |
| Session management | JWT with short expiry (1 hour), refresh tokens |
| API protection | tRPC middleware for auth check |
| Rate limiting | Per-user limits on API endpoints |

### 11.2 Data Protection

| Data Type | Protection |
|-----------|------------|
| OAuth tokens | Encrypted at rest (AES-256) |
| User data | SQLite file encryption (optional) |
| Images | Private R2 bucket, signed URLs |
| Audit logs | Immutable, append-only |

### 11.3 API Security

| Concern | Solution |
|---------|----------|
| eBay webhooks | Verify X-EBAY-SIGNATURE header |
| CSRF | NextAuth.js built-in protection |
| XSS | React auto-escaping, CSP headers |
| Input validation | Zod schemas on all tRPC inputs |

### 11.4 Operational Security

| Concern | Solution |
|---------|----------|
| Secrets management | Environment variables, Vercel encrypted |
| Error handling | Never expose internal errors to client |
| Logging | Structured logs, PII redacted |
| Dependency security | Dependabot alerts, regular updates |

---

## 12. ADR References

| ADR | Title | Status | Impact |
|-----|-------|--------|--------|
| [ADR-0001](./decisions/ADR-0001-channel-strategy.md) | Channel Strategy | Accepted | Defines native vs assisted integration modes |
| ADR-0002 | Tech Stack Selection | Pending | Rationale for Next.js, tRPC, SQLite, Inngest |
| ADR-0003 | Autopilot Confidence Model | Pending | Confidence scoring algorithm |
| ADR-0004 | Rate Limiting Strategy | Pending | eBay 250 revision limit handling |

---

## 13. Implementation Phases

### Phase 4.1: Foundation (Week 1-2)
- [ ] Project scaffolding (Next.js, tRPC, Drizzle)
- [ ] Database schema and migrations
- [ ] NextAuth.js setup with eBay OAuth
- [ ] R2 integration for image uploads
- [ ] Basic UI shell (dashboard layout)

### Phase 4.2: Core Features (Week 3-4)
- [ ] AI listing generation service
- [ ] eBay adapter (publish, delist)
- [ ] Inventory management CRUD
- [ ] Order sync from eBay

### Phase 4.3: Autopilot (Week 5-6)
- [ ] Inngest job setup
- [ ] Delist-on-sale automation
- [ ] Offer handling rules
- [ ] Repricing engine
- [ ] Audit logging

### Phase 4.4: Polish (Week 7-8)
- [ ] Poshmark/Mercari assisted templates
- [ ] Analytics dashboard
- [ ] Error handling and retry logic
- [ ] E2E testing
- [ ] Performance optimization

---

## Status
- **State**: COMPLETE
- **Created**: 2026-02-03
- **Owner**: planner, implementer
- **Next**: Phase 4 Implementation
