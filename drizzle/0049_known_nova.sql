ALTER TABLE `planning_team_accesses` ADD `contactId` int;--> statement-breakpoint
ALTER TABLE `planning_team_accesses` ADD CONSTRAINT `planning_team_access_contact_unique` UNIQUE(`contactId`);--> statement-breakpoint
ALTER TABLE `planning_team_accesses` ADD CONSTRAINT `pta_contact_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;
