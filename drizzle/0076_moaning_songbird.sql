CREATE TABLE `tenant_product_expiry_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`endsOn` date NOT NULL,
	`leaseUntil` timestamp,
	`lastAttemptedAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_product_expiry_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_product_expiry_notifications_tenant_end_unique` UNIQUE(`tenantId`,`endsOn`)
);
--> statement-breakpoint
ALTER TABLE `tenant_product_expiry_notifications` ADD CONSTRAINT `tenant_product_expiry_notifications_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tenant_product_expiry_notifications_delivery_idx` ON `tenant_product_expiry_notifications` (`sentAt`,`leaseUntil`);