ALTER TABLE `sessions` ADD `viewer_invite_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `sessions` SET `viewer_invite_code` = lower(hex(randomblob(8))) WHERE `viewer_invite_code` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_viewer_invite_code_unique` ON `sessions` (`viewer_invite_code`);
