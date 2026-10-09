CREATE TABLE `pilot_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractNumber` varchar(40) NOT NULL,
	`tenantId` varchar(96),
	`clubName` varchar(200) NOT NULL,
	`legalName` varchar(240) NOT NULL,
	`contactName` varchar(120) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`packageId` enum('event_pass','light','pro','enterprise') NOT NULL,
	`startsOn` date NOT NULL,
	`endsOn` date NOT NULL,
	`status` enum('draft','agreed','archived') NOT NULL DEFAULT 'draft',
	`internalNote` text,
	`agreedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pilot_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilot_contracts_number_unique` UNIQUE(`contractNumber`)
);
--> statement-breakpoint
ALTER TABLE `pilot_contracts` ADD CONSTRAINT `pilot_contracts_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilot_contracts_status_created_idx` ON `pilot_contracts` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pilot_contracts_tenant_idx` ON `pilot_contracts` (`tenantId`);