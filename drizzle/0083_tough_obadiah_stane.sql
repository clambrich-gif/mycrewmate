CREATE TABLE `tenant_contract_acceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`acceptedByUserId` int NOT NULL,
	`documentId` enum('terms','avv','privacy') NOT NULL,
	`documentVersion` varchar(64) NOT NULL,
	`documentHash` varchar(64) NOT NULL,
	`packageId` enum('event_pass','light','pro','enterprise') NOT NULL,
	`packageStatus` enum('test','active','paused','expired') NOT NULL,
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_contract_acceptances_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_contract_acceptances_version_unique` UNIQUE(`tenantId`,`documentId`,`documentVersion`)
);
--> statement-breakpoint
ALTER TABLE `tenant_contract_acceptances` ADD CONSTRAINT `tenant_contract_acceptances_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_contract_acceptances` ADD CONSTRAINT `tenant_contract_acceptances_user_id_users_id_fk` FOREIGN KEY (`acceptedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tenant_contract_acceptances_tenant_accepted_idx` ON `tenant_contract_acceptances` (`tenantId`,`acceptedAt`);