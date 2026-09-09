CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`timestamp` text NOT NULL,
	`metadata` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`blocked_until` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`device_type` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dose_events` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`medication_id` text NOT NULL,
	`schedule_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`acknowledged_at` text,
	`status` text NOT NULL,
	`confirmation_type` text,
	`confirmed_by_user_id` text,
	`device_id` text,
	`notes` text,
	`snoozed_until` text,
	`display_name` text NOT NULL,
	`dose_display` text NOT NULL,
	`instructions` text NOT NULL,
	`requires_supervision` integer NOT NULL,
	`grace_period_minutes` integer NOT NULL,
	`period` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dose_schedule_time` ON `dose_events` (`schedule_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`instructions` text NOT NULL,
	`dose_display` text NOT NULL,
	`image` text,
	`active` integer DEFAULT true NOT NULL,
	`privacy_mode` integer DEFAULT true NOT NULL,
	`requires_supervision` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reward_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`point_cost` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reward_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`points` integer NOT NULL,
	`reason` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_source` ON `reward_events` (`user_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `reward_settings` (
	`household_id` text PRIMARY KEY NOT NULL,
	`medication` integer DEFAULT 2 NOT NULL,
	`daily` integer DEFAULT 3 NOT NULL,
	`seven_day` integer DEFAULT 10 NOT NULL,
	`thirty_day` integer DEFAULT 25 NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedule_days` (
	`schedule_id` text NOT NULL,
	`day` integer NOT NULL,
	PRIMARY KEY(`schedule_id`, `day`),
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`schedule_type` text NOT NULL,
	`time_of_day` text NOT NULL,
	`exact_time` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`grace_period_minutes` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`generated_through` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text,
	`reward_points` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
