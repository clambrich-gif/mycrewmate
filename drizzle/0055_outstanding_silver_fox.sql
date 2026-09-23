CREATE TABLE `user_tenant_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`role` enum('tenant_admin','planner') NOT NULL DEFAULT 'planner',
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_tenant_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_tenant_memberships_user_tenant_unique` UNIQUE(`userId`,`tenantId`)
);
--> statement-breakpoint
ALTER TABLE `user_tenant_memberships` ADD CONSTRAINT `user_tenant_memberships_user_id_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_tenant_memberships` ADD CONSTRAINT `user_tenant_memberships_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_tenant_memberships_user_status_idx` ON `user_tenant_memberships` (`userId`,`status`,`isDefault`);--> statement-breakpoint
CREATE INDEX `user_tenant_memberships_tenant_status_idx` ON `user_tenant_memberships` (`tenantId`,`status`);--> statement-breakpoint
-- Der bestehende globale Administrator bleibt während der Pilotphase RSC-Administrator.
-- Es werden weder Planungsdaten geändert noch weitere Konten automatisch freigeschaltet.
UPDATE `user_tenant_memberships` memberships
INNER JOIN `users` user ON user.`id` = memberships.`userId`
SET memberships.`isDefault` = false
WHERE user.`openId` = 'shared-password-admin';--> statement-breakpoint
INSERT INTO `user_tenant_memberships` (`userId`, `tenantId`, `role`, `status`, `isDefault`)
SELECT user.`id`, 'rsc-eifelland-mayen', 'tenant_admin', 'active', true
FROM `users` user
WHERE user.`openId` = 'shared-password-admin'
ON DUPLICATE KEY UPDATE
  `role` = 'tenant_admin',
  `status` = 'active',
  `isDefault` = true;
