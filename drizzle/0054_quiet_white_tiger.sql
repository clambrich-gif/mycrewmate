CREATE TABLE `tenants` (
	`id` varchar(96) NOT NULL,
	`name` varchar(200) NOT NULL,
	`legalName` varchar(240) NOT NULL,
	`status` enum('pilot','sample','active','suspended','archived') NOT NULL DEFAULT 'sample',
	`planName` varchar(120) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`supportEmail` varchar(320) NOT NULL,
	`logoKey` varchar(500),
	`logoUrl` varchar(700),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
INSERT INTO `tenants` (
	`id`,
	`name`,
	`legalName`,
	`status`,
	`planName`,
	`contactEmail`,
	`supportEmail`
) VALUES
	('rsc-eifelland-mayen', 'RSC Eifelland Mayen e. V.', 'Radsportclub Eifelland Mayen e. V.', 'pilot', 'Pilotbetrieb', 'info@mycrewmate.de', 'support@mycrewmate.de'),
	('kirmesverein-musterstadt', 'Kirmesverein Musterstadt e. V.', 'Kirmesverein Musterstadt e. V.', 'sample', 'Musterverein', 'info@mycrewmate.de', 'support@mycrewmate.de'),
	('schuetzenverein-musterhausen', 'Schützenverein Musterhausen e. V.', 'Schützenverein Musterhausen e. V.', 'sample', 'Musterverein', 'info@mycrewmate.de', 'support@mycrewmate.de')
ON DUPLICATE KEY UPDATE
	`name` = VALUES(`name`),
	`legalName` = VALUES(`legalName`),
	`status` = VALUES(`status`),
	`planName` = VALUES(`planName`),
	`contactEmail` = VALUES(`contactEmail`),
	`supportEmail` = VALUES(`supportEmail`);
--> statement-breakpoint
CREATE INDEX `events_year_fk_idx` ON `events` (`year`);--> statement-breakpoint
ALTER TABLE `events` DROP INDEX `events_year_name_unique`;--> statement-breakpoint
ALTER TABLE `events` ADD `tenantId` varchar(96) DEFAULT 'rsc-eifelland-mayen' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_tenant_year_name_unique` UNIQUE(`tenantId`,`year`,`name`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE restrict ON UPDATE no action;
