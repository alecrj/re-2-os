CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_provider_providerAccountId_idx` ON `accounts` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action_type` text NOT NULL,
	`action_id` text,
	`item_id` text,
	`channel` text,
	`before_state` text,
	`after_state` text,
	`source` text NOT NULL,
	`metadata` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_user_timestamp_idx` ON `audit_log` (`user_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `autopilot_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text,
	`rule_id` text,
	`action_type` text NOT NULL,
	`confidence` real NOT NULL,
	`confidence_level` text NOT NULL,
	`before_state` text,
	`after_state` text,
	`payload` text,
	`status` text NOT NULL,
	`requires_approval` integer NOT NULL,
	`reversible` integer NOT NULL,
	`undo_deadline` integer,
	`created_at` integer NOT NULL,
	`executed_at` integer,
	`undone_at` integer,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `autopilot_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `autopilot_actions_status_created_at_idx` ON `autopilot_actions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `autopilot_actions_user_id_idx` ON `autopilot_actions` (`user_id`);--> statement-breakpoint
CREATE TABLE `autopilot_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rule_type` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `autopilot_rules_user_type_idx` ON `autopilot_rules` (`user_id`,`rule_type`);--> statement-breakpoint
CREATE TABLE `channel_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` integer,
	`external_user_id` text,
	`external_username` text,
	`status` text NOT NULL,
	`last_sync_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_connections_user_channel_idx` ON `channel_connections` (`user_id`,`channel`);--> statement-breakpoint
CREATE TABLE `channel_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`channel` text NOT NULL,
	`external_id` text,
	`external_url` text,
	`price` real NOT NULL,
	`status` text NOT NULL,
	`status_message` text,
	`requires_manual_action` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	`ended_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_listings_item_id_idx` ON `channel_listings` (`item_id`);--> statement-breakpoint
CREATE INDEX `channel_listings_channel_status_idx` ON `channel_listings` (`channel`,`status`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sku` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`condition` text NOT NULL,
	`asking_price` real NOT NULL,
	`floor_price` real,
	`cost_basis` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`ai_confidence` real,
	`suggested_category` text,
	`item_specifics` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`listed_at` integer,
	`sold_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inventory_items_user_id_idx` ON `inventory_items` (`user_id`);--> statement-breakpoint
CREATE INDEX `inventory_items_status_idx` ON `inventory_items` (`status`);--> statement-breakpoint
CREATE INDEX `inventory_items_user_status_idx` ON `inventory_items` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `inventory_items_sku_idx` ON `inventory_items` (`user_id`,`sku`);--> statement-breakpoint
CREATE TABLE `item_images` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`original_url` text NOT NULL,
	`processed_url` text,
	`position` integer DEFAULT 0 NOT NULL,
	`width` integer,
	`height` integer,
	`size_bytes` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `item_images_item_id_idx` ON `item_images` (`item_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`channel_listing_id` text,
	`channel` text NOT NULL,
	`external_order_id` text,
	`sale_price` real NOT NULL,
	`shipping_paid` real,
	`platform_fees` real,
	`shipping_cost` real,
	`net_profit` real,
	`buyer_username` text,
	`shipping_address` text,
	`status` text NOT NULL,
	`ordered_at` integer NOT NULL,
	`paid_at` integer,
	`shipped_at` integer,
	`delivered_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_listing_id`) REFERENCES `channel_listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_ordered_at_idx` ON `orders` (`ordered_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`emailVerified` integer,
	`name` text,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`tier_expires_at` integer,
	`listings_this_month` integer DEFAULT 0 NOT NULL,
	`bg_removals_this_month` integer DEFAULT 0 NOT NULL,
	`period_reset_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verificationTokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verificationTokens_token_unique` ON `verificationTokens` (`token`);--> statement-breakpoint
CREATE INDEX `verificationTokens_identifier_token_idx` ON `verificationTokens` (`identifier`,`token`);