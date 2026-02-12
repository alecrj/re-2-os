ALTER TABLE `inventory_items` ADD `storage_location` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `bin` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `shelf` text;--> statement-breakpoint
CREATE INDEX `inventory_items_storage_location_idx` ON `inventory_items` (`user_id`,`storage_location`);