CREATE TABLE `tenant_product_assignments` (
	`tenantId` varchar(96) NOT NULL,
	`packageId` enum('event_pass','light','pro','enterprise') NOT NULL DEFAULT 'pro',
	`status` enum('test','active','paused','expired') NOT NULL DEFAULT 'test',
	`startsOn` date,
	`endsOn` date,
	`eventId` int,
	`internalNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_product_assignments_tenantId` PRIMARY KEY(`tenantId`)
);
--> statement-breakpoint
ALTER TABLE `tenant_product_assignments` ADD CONSTRAINT `tenant_product_assignments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_product_assignments` ADD CONSTRAINT `tenant_product_assignments_event_id_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tenant_product_assignments_package_status_idx` ON `tenant_product_assignments` (`packageId`,`status`);