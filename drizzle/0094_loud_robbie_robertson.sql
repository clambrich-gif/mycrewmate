CREATE TABLE `pilot_inquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clubName` varchar(160) NOT NULL,
	`contactName` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(60) NOT NULL,
	`occasion` varchar(120) NOT NULL,
	`desiredStart` varchar(7) NOT NULL,
	`note` text,
	`status` enum('open','accepted','declined') NOT NULL DEFAULT 'open',
	`privacyAcceptedAt` timestamp NOT NULL,
	`closedAt` timestamp,
	`retentionEndsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pilot_inquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_pilot_end_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`archivedAt` timestamp NOT NULL,
	`leaseUntil` timestamp,
	`lastAttemptedAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_pilot_end_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_pilot_end_notifications_tenant_archive_unique` UNIQUE(`tenantId`,`archivedAt`)
);
--> statement-breakpoint
ALTER TABLE `tenants` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `retentionEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `archiveReason` enum('pilot_expired','manual');--> statement-breakpoint
ALTER TABLE `tenant_pilot_end_notifications` ADD CONSTRAINT `tenant_pilot_end_notifications_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilot_inquiries_status_created_idx` ON `pilot_inquiries` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pilot_inquiries_retention_cleanup_idx` ON `pilot_inquiries` (`retentionEndsAt`,`closedAt`);--> statement-breakpoint
CREATE INDEX `tenant_pilot_end_notifications_delivery_idx` ON `tenant_pilot_end_notifications` (`sentAt`,`leaseUntil`);--> statement-breakpoint
CREATE INDEX `tenants_pilot_retention_idx` ON `tenants` (`status`,`archiveReason`,`retentionEndsAt`);