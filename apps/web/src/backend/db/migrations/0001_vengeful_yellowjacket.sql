CREATE TABLE `vault_item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`type` text,
	`title` text,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`ocr_text` text,
	`extracted` text,
	`expires_at` integer,
	`reminded_at` integer,
	`error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
