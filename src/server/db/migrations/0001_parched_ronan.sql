ALTER TABLE `audit_log` ADD `reversible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `undo_deadline` integer;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `reversed_at` integer;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `reversed_by_audit_id` text;--> statement-breakpoint
CREATE INDEX `audit_log_reversible_idx` ON `audit_log` (`user_id`,`reversible`,`undo_deadline`);