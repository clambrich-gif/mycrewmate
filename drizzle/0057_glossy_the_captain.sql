ALTER TABLE `planning_team_accesses` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `planning_team_accesses` ADD `modulePermissions` json;--> statement-breakpoint
ALTER TABLE `planning_team_accesses` ADD CONSTRAINT `planning_team_access_email_unique` UNIQUE(`email`);