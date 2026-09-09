CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_keys` (
	`id` integer PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`device_id` text PRIMARY KEY NOT NULL,
	`subscription` text NOT NULL,
	`retry_at` text,
	`failures` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
