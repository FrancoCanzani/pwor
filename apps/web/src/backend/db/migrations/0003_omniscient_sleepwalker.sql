CREATE TABLE `vault_category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `vault_item` ADD `category_id` text REFERENCES vault_category(id);--> statement-breakpoint
ALTER TABLE `vault_item` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `vault_item` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `vault_item` ADD `extracted_markdown` text;--> statement-breakpoint
ALTER TABLE `vault_item` ADD `parse_status` text;--> statement-breakpoint
ALTER TABLE `vault_item` ADD `parse_error` text;--> statement-breakpoint
ALTER TABLE `vault_item` ADD `parsed_at` integer;