CREATE TABLE `platform_launch_settings` (
	`id` int NOT NULL DEFAULT 1,
	`paymentsEnabled` boolean NOT NULL DEFAULT false,
	`publicSelfServiceEnabled` boolean NOT NULL DEFAULT false,
	`paymentProvider` enum('none','stripe') NOT NULL DEFAULT 'none',
	`invoiceWorkflow` enum('manual','automated') NOT NULL DEFAULT 'manual',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_launch_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_tenant_handoffs` (
	`tokenHash` varchar(64) NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`createdByOpenId` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_tenant_handoffs_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `tenant_admin_credentials` (
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`mustChangePassword` boolean NOT NULL DEFAULT true,
	`sessionVersion` int NOT NULL DEFAULT 1,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_admin_credentials_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `tenant_admin_credentials_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `platform_tenant_handoffs` ADD CONSTRAINT `platform_tenant_handoffs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_admin_credentials` ADD CONSTRAINT `tenant_admin_credentials_user_id_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `platform_tenant_handoffs_expiry_idx` ON `platform_tenant_handoffs` (`expiresAt`);