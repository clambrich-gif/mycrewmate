CREATE TABLE `tenant_admin_invitations` (
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_admin_invitations_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `tenant_admin_invitations` ADD CONSTRAINT `tenant_admin_invitations_user_id_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_admin_invitations` ADD CONSTRAINT `tenant_admin_invitations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tenant_admin_invitations_user_expiry_idx` ON `tenant_admin_invitations` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `tenant_admin_invitations_expiry_idx` ON `tenant_admin_invitations` (`expiresAt`);