CREATE TABLE `planning_team_invitations` (
	`tokenHash` varchar(64) NOT NULL,
	`accessId` int NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planning_team_invitations_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `planning_team_invitations` ADD CONSTRAINT `planning_team_invitations_access_id_planning_team_accesses_id_fk` FOREIGN KEY (`accessId`) REFERENCES `planning_team_accesses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planning_team_invitations` ADD CONSTRAINT `planning_team_invitations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `planning_team_invitations_access_tenant_expiry_idx` ON `planning_team_invitations` (`accessId`,`tenantId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `planning_team_invitations_expiry_idx` ON `planning_team_invitations` (`expiresAt`);