CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`preferences` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_id_unique` ON `notification_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_prefs_user_id_idx` ON `notification_preferences` (`user_id`);