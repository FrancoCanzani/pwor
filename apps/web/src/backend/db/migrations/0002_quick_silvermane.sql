ALTER TABLE `item` ADD `normalized_url` text;--> statement-breakpoint
CREATE INDEX `item_user_normalized_url` ON `item` (`user_id`,`normalized_url`);