CREATE TABLE `mfa_login_challenges` (
	`tokenHash` varchar(64) NOT NULL,
	`subjectType` enum('master','tenant_admin') NOT NULL,
	`userId` int,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mfa_login_challenges_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminMfaSecretEncrypted` varchar(512);--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminMfaRecoveryCodeHashes` json;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminMfaEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminMfaEnrolledAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenant_admin_credentials` ADD `mfaSecretEncrypted` varchar(512);--> statement-breakpoint
ALTER TABLE `tenant_admin_credentials` ADD `mfaRecoveryCodeHashes` json;--> statement-breakpoint
ALTER TABLE `tenant_admin_credentials` ADD `mfaEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_admin_credentials` ADD `mfaEnrolledAt` timestamp;--> statement-breakpoint
ALTER TABLE `mfa_login_challenges` ADD CONSTRAINT `mfa_login_challenges_user_id_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mfa_login_challenges_expiry_idx` ON `mfa_login_challenges` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `mfa_login_challenges_subject_expiry_idx` ON `mfa_login_challenges` (`subjectType`,`userId`,`expiresAt`);