ALTER TABLE `sessions` ADD `invite_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `sessions` SET `invite_code` = lower(hex(randomblob(5)));--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_invite_code_unique` ON `sessions` (`invite_code`);--> statement-breakpoint
DROP TABLE `invites`;--> statement-breakpoint
ALTER TABLE `memberships` DROP COLUMN `sharing_enabled`;--> statement-breakpoint
ALTER TABLE `memberships` DROP COLUMN `viewing_enabled`;--> statement-breakpoint
ALTER TABLE `memberships` DROP COLUMN `allowed_sharing`;--> statement-breakpoint
ALTER TABLE `memberships` DROP COLUMN `allowed_viewing`;
