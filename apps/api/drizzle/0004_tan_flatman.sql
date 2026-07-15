CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`code` text NOT NULL,
	`allow_sharing` integer NOT NULL,
	`allow_viewing` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_unique` ON `invites` (`code`);--> statement-breakpoint
CREATE INDEX `idx_invites_session` ON `invites` (`session_id`);--> statement-breakpoint
INSERT INTO `invites` (`id`, `session_id`, `code`, `allow_sharing`, `allow_viewing`, `revoked_at`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, `invite_code`, 1, 1, NULL, `created_at` FROM `sessions`;--> statement-breakpoint
INSERT INTO `invites` (`id`, `session_id`, `code`, `allow_sharing`, `allow_viewing`, `revoked_at`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, `viewer_invite_code`, 0, 1, NULL, `created_at` FROM `sessions`;--> statement-breakpoint
DROP INDEX `sessions_invite_code_unique`;--> statement-breakpoint
DROP INDEX `sessions_viewer_invite_code_unique`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `invite_code`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `viewer_invite_code`;--> statement-breakpoint
ALTER TABLE `memberships` ADD `allowed_sharing` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `allowed_viewing` integer DEFAULT true NOT NULL;