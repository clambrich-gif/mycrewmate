ALTER TABLE `security_settings` ADD `adminFailedAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminLocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminPasswordResetTokenHash` varchar(64);--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminPasswordResetExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminPasswordResetRequestedAt` timestamp;