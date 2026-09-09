CREATE TABLE `as_needed_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`user_id` text NOT NULL,
	`used_at` text NOT NULL,
	`display_name` text NOT NULL,
	`dose_display` text NOT NULL,
	`confirmed_by_user_id` text,
	`confirmation_type` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `medications` ADD `usage_type` text DEFAULT 'SCHEDULED' NOT NULL;