ALTER TABLE `note` ADD `feed_item_id` text REFERENCES feed_item(id);--> statement-breakpoint
CREATE INDEX `note_feed_item` ON `note` (`feed_item_id`);