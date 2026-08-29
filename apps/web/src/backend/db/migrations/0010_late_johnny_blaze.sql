PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_note` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`space_id` text,
	`title` text,
	`body` text DEFAULT '' NOT NULL,
	`item_id` text,
	`anchor_from` integer,
	`anchor_to` integer,
	`anchor_quote` text,
	`anchor_prefix` text,
	`anchor_suffix` text,
	`embed_status` text DEFAULT 'pending' NOT NULL,
	`embedded_at` integer,
	`pinned_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `space`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_note`("id", "user_id", "space_id", "title", "body", "item_id", "anchor_from", "anchor_to", "anchor_quote", "anchor_prefix", "anchor_suffix", "embed_status", "embedded_at", "pinned_at", "created_at", "updated_at") SELECT "id", "user_id", "space_id", "title", "body", "item_id", "anchor_from", "anchor_to", "anchor_quote", "anchor_prefix", "anchor_suffix", "embed_status", "embedded_at", "pinned_at", "created_at", "updated_at" FROM `note`;--> statement-breakpoint
DROP TABLE `note`;--> statement-breakpoint
ALTER TABLE `__new_note` RENAME TO `note`;--> statement-breakpoint
DROP TABLE `feed_item`;--> statement-breakpoint
DROP TABLE `feed`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `note_user_updated` ON `note` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `note_space` ON `note` (`space_id`);--> statement-breakpoint
CREATE INDEX `note_item` ON `note` (`item_id`);
