import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ============ USERS ============

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").unique(), // Optional - eBay doesn't always provide email
    emailVerified: integer("emailVerified", { mode: "timestamp" }),
    name: text("name"),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),

    // Subscription
    tier: text("tier", {
      enum: ["free", "starter", "pro", "power", "business"],
    })
      .notNull()
      .default("free"),
    tierExpiresAt: integer("tier_expires_at", { mode: "timestamp" }),

    // Limits (current period)
    listingsThisMonth: integer("listings_this_month").notNull().default(0),
    bgRemovalsThisMonth: integer("bg_removals_this_month").notNull().default(0),
    periodResetAt: integer("period_reset_at", { mode: "timestamp" }),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

// ============ NEXTAUTH TABLES ============

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "oidc" | "email">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    providerProviderAccountIdIdx: index("accounts_provider_providerAccountId_idx").on(
      table.provider,
      table.providerAccountId
    ),
    userIdIdx: index("accounts_userId_idx").on(table.userId),
  })
);

export const sessions = sqliteTable(
  "sessions",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("sessions_userId_idx").on(table.userId),
  })
);

export const verificationTokens = sqliteTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    identifierTokenIdx: index("verificationTokens_identifier_token_idx").on(
      table.identifier,
      table.token
    ),
  })
);

// ============ CHANNEL CONNECTIONS ============

export const channelConnections = sqliteTable(
  "channel_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    channel: text("channel", {
      enum: ["ebay", "poshmark", "mercari", "depop"],
    }).notNull(),

    // OAuth tokens (encrypted)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }),

    // Channel-specific data
    externalUserId: text("external_user_id"),
    externalUsername: text("external_username"),

    // Status
    status: text("status", { enum: ["active", "expired", "revoked"] }).notNull(),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userChannelIdx: index("channel_connections_user_channel_idx").on(
      table.userId,
      table.channel
    ),
  })
);

// ============ INVENTORY ============

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sku: text("sku").notNull(),

    // Core fields
    title: text("title").notNull(),
    description: text("description").notNull(),
    condition: text("condition", {
      enum: ["new", "like_new", "good", "fair", "poor"],
    }).notNull(),

    // Pricing
    askingPrice: real("asking_price").notNull(),
    floorPrice: real("floor_price"),
    costBasis: real("cost_basis"), // What user paid (COGS)

    // Status
    status: text("status", {
      enum: ["draft", "active", "sold", "shipped", "archived"],
    })
      .notNull()
      .default("draft"),
    quantity: integer("quantity").notNull().default(1),

    // AI-generated data
    aiConfidence: real("ai_confidence"),
    suggestedCategory: text("suggested_category"),
    itemSpecifics: text("item_specifics", { mode: "json" }).$type<
      Record<string, string>
    >(),

    // Storage & Organization
    storageLocation: text("storage_location"), // e.g. "Garage", "Closet A"
    bin: text("bin"), // e.g. "B3", "Tote-12"
    shelf: text("shelf"), // e.g. "Top", "S2"
    shipReady: integer("ship_ready", { mode: "boolean" }).notNull().default(false),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    listedAt: integer("listed_at", { mode: "timestamp" }),
    soldAt: integer("sold_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdIdx: index("inventory_items_user_id_idx").on(table.userId),
    statusIdx: index("inventory_items_status_idx").on(table.status),
    userStatusIdx: index("inventory_items_user_status_idx").on(
      table.userId,
      table.status
    ),
    skuIdx: index("inventory_items_sku_idx").on(table.userId, table.sku),
    storageLocationIdx: index("inventory_items_storage_location_idx").on(
      table.userId,
      table.storageLocation
    ),
  })
);

// ============ IMAGES ============

export const itemImages = sqliteTable(
  "item_images",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    // Storage
    originalUrl: text("original_url").notNull(), // R2 URL
    processedUrl: text("processed_url"), // After BG removal

    // Metadata
    position: integer("position").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    itemIdIdx: index("item_images_item_id_idx").on(table.itemId),
  })
);

// ============ CHANNEL LISTINGS ============

export const channelListings = sqliteTable(
  "channel_listings",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    channel: text("channel", {
      enum: ["ebay", "poshmark", "mercari", "depop"],
    }).notNull(),

    // External reference
    externalId: text("external_id"), // Platform listing ID
    externalUrl: text("external_url"),

    // Channel-specific pricing (may differ from inventory)
    price: real("price").notNull(),

    // Status
    status: text("status", {
      enum: ["draft", "pending", "active", "ended", "sold", "error"],
    }).notNull(),
    statusMessage: text("status_message"),

    // For assisted channels
    requiresManualAction: integer("requires_manual_action", { mode: "boolean" })
      .notNull()
      .default(false),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),
  },
  (table) => ({
    itemIdIdx: index("channel_listings_item_id_idx").on(table.itemId),
    channelStatusIdx: index("channel_listings_channel_status_idx").on(
      table.channel,
      table.status
    ),
  })
);

// ============ ORDERS ============

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    itemId: text("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    channelListingId: text("channel_listing_id").references(
      () => channelListings.id
    ),

    // Order details
    channel: text("channel", {
      enum: ["ebay", "poshmark", "mercari", "depop"],
    }).notNull(),
    externalOrderId: text("external_order_id"),

    // Financials
    salePrice: real("sale_price").notNull(),
    shippingPaid: real("shipping_paid"),
    platformFees: real("platform_fees"),
    shippingCost: real("shipping_cost"),
    netProfit: real("net_profit"), // Calculated

    // Buyer info (minimal for privacy)
    buyerUsername: text("buyer_username"),
    shippingAddress: text("shipping_address", { mode: "json" }).$type<{
      name?: string;
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>(),

    // Status
    status: text("status", {
      enum: ["pending", "paid", "shipped", "delivered", "returned", "cancelled"],
    }).notNull(),

    // Timestamps
    orderedAt: integer("ordered_at", { mode: "timestamp" }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    shippedAt: integer("shipped_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdIdx: index("orders_user_id_idx").on(table.userId),
    orderedAtIdx: index("orders_ordered_at_idx").on(table.orderedAt),
  })
);

// ============ AUTOPILOT ============

export const autopilotRules = sqliteTable(
  "autopilot_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),

    // Rule type
    ruleType: text("rule_type", {
      enum: ["offer", "reprice", "stale", "delist"],
    }).notNull(),

    // Configuration (JSON based on rule type)
    config: text("config", { mode: "json" }).notNull().$type<
      | OfferRuleConfig
      | RepriceRuleConfig
      | StaleRuleConfig
      | DelistRuleConfig
    >(),

    // Status
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userTypeIdx: index("autopilot_rules_user_type_idx").on(
      table.userId,
      table.ruleType
    ),
  })
);

// Rule config types
export interface OfferRuleConfig {
  autoAcceptThreshold: number;
  autoDeclineThreshold: number;
  autoCounterEnabled: boolean;
  counterStrategy: "floor" | "midpoint" | "asking-5%";
  maxCounterRounds: number;
  highValueThreshold: number;
}

export interface RepriceRuleConfig {
  strategy: "time_decay" | "performance" | "competitive";
  maxDailyDropPercent: number;
  maxWeeklyDropPercent: number;
  respectFloorPrice: boolean;
  highValueThreshold: number;
}

export interface StaleRuleConfig {
  daysUntilStale: number;
  notifyOnly: boolean;
  autoRelist: boolean;
}

export interface DelistRuleConfig {
  autoDelistOnSale: boolean;
  notifyForAssistedChannels: boolean;
}

export const autopilotActions = sqliteTable(
  "autopilot_actions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    itemId: text("item_id").references(() => inventoryItems.id),
    ruleId: text("rule_id").references(() => autopilotRules.id),

    // Action details
    actionType: text("action_type", {
      enum: [
        "OFFER_ACCEPT",
        "OFFER_DECLINE",
        "OFFER_COUNTER",
        "REPRICE",
        "DELIST",
        "RELIST",
        "ARCHIVE",
      ],
    }).notNull(),

    // Confidence
    confidence: real("confidence").notNull(),
    confidenceLevel: text("confidence_level", {
      enum: ["HIGH", "MEDIUM", "LOW", "VERY_LOW"],
    }).notNull(),

    // State tracking
    beforeState: text("before_state", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    afterState: text("after_state", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),

    // Execution
    status: text("status", {
      enum: ["pending", "approved", "executed", "failed", "rejected", "undone"],
    }).notNull(),
    requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull(),

    // Undo capability
    reversible: integer("reversible", { mode: "boolean" }).notNull(),
    undoDeadline: integer("undo_deadline", { mode: "timestamp" }),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    executedAt: integer("executed_at", { mode: "timestamp" }),
    undoneAt: integer("undone_at", { mode: "timestamp" }),

    // Error tracking
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
  },
  (table) => ({
    statusCreatedAtIdx: index("autopilot_actions_status_created_at_idx").on(
      table.status,
      table.createdAt
    ),
    userIdIdx: index("autopilot_actions_user_id_idx").on(table.userId),
  })
);

// ============ AUDIT LOG ============

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),

    // What happened
    actionType: text("action_type").notNull(),
    actionId: text("action_id"), // Links to autopilotActions if automated
    itemId: text("item_id"),
    channel: text("channel"),

    // State change
    beforeState: text("before_state", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    afterState: text("after_state", { mode: "json" }).$type<
      Record<string, unknown>
    >(),

    // Source
    source: text("source", {
      enum: ["AUTOPILOT", "USER", "SYSTEM", "WEBHOOK"],
    }).notNull(),

    // Metadata
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),

    // Undo capability
    reversible: integer("reversible", { mode: "boolean" }).notNull().default(false),
    undoDeadline: integer("undo_deadline", { mode: "timestamp" }),
    reversedAt: integer("reversed_at", { mode: "timestamp" }),
    reversedByAuditId: text("reversed_by_audit_id"),

    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userTimestampIdx: index("audit_log_user_timestamp_idx").on(
      table.userId,
      table.timestamp
    ),
    reversibleIdx: index("audit_log_reversible_idx").on(
      table.userId,
      table.reversible,
      table.undoDeadline
    ),
  })
);

// ============ NOTIFICATION PREFERENCES ============

export interface NotificationPrefs {
  offerReceived: { inApp: boolean; email: boolean };
  offerAutoActioned: { inApp: boolean; email: boolean };
  saleConfirmed: { inApp: boolean; email: boolean };
  delistAlert: { inApp: boolean; email: boolean };
  repriceAlert: { inApp: boolean; email: boolean };
  staleListingAlert: { inApp: boolean; email: boolean };
  syncError: { inApp: boolean; email: boolean };
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  offerReceived: { inApp: true, email: true },
  offerAutoActioned: { inApp: true, email: false },
  saleConfirmed: { inApp: true, email: true },
  delistAlert: { inApp: true, email: true },
  repriceAlert: { inApp: true, email: false },
  staleListingAlert: { inApp: true, email: false },
  syncError: { inApp: true, email: true },
};

export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id)
      .unique(),
    preferences: text("preferences", { mode: "json" })
      .notNull()
      .$type<NotificationPrefs>(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("notification_prefs_user_id_idx").on(table.userId),
  })
);

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  channelConnections: many(channelConnections),
  inventoryItems: many(inventoryItems),
  orders: many(orders),
  autopilotRules: many(autopilotRules),
  autopilotActions: many(autopilotActions),
  auditLog: many(auditLog),
  notificationPreferences: one(notificationPreferences),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ one, many }) => ({
    user: one(users, {
      fields: [inventoryItems.userId],
      references: [users.id],
    }),
    images: many(itemImages),
    channelListings: many(channelListings),
    orders: many(orders),
  })
);

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

export const channelConnectionsRelations = relations(
  channelConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [channelConnections.userId],
      references: [users.id],
    }),
  })
);

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

export const autopilotRulesRelations = relations(
  autopilotRules,
  ({ one, many }) => ({
    user: one(users, {
      fields: [autopilotRules.userId],
      references: [users.id],
    }),
    actions: many(autopilotActions),
  })
);

export const autopilotActionsRelations = relations(
  autopilotActions,
  ({ one }) => ({
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
  })
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));
