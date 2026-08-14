DROP TABLE `category`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`kind` text DEFAULT 'file' NOT NULL,
	`title` text,
	`summary` text,
	`tags` text,
	`language` text,
	`r2_key` text,
	`size_bytes` integer,
	`mime_type` text,
	`url` text,
	`site_name` text,
	`content` text,
	`extracted_markdown` text,
	`preview_r2_key` text,
	`parse_status` text,
	`parse_error` text,
	`parsed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_item`("id", "user_id", "workspace_id", "kind", "title", "summary", "tags", "language", "r2_key", "size_bytes", "mime_type", "url", "site_name", "content", "extracted_markdown", "preview_r2_key", "parse_status", "parse_error", "parsed_at", "created_at", "updated_at") SELECT "id", "user_id", "workspace_id", "kind", "title", "summary", "tags", "language", "r2_key", "size_bytes", "mime_type", "url", "site_name", "content", "extracted_markdown", "preview_r2_key", "parse_status", "parse_error", "parsed_at", "created_at", "updated_at" FROM `item`;--> statement-breakpoint
DROP TABLE `item`;--> statement-breakpoint
ALTER TABLE `__new_item` RENAME TO `item`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `item_user_created` ON `item` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `item_workspace` ON `item` (`workspace_id`);