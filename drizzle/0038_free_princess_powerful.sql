ALTER TABLE `deletion_audit_logs` MODIFY COLUMN `entityType` enum('helper','cake','prep','post') NOT NULL;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD `category` varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD `dueText` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD `locationId` int;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD `deleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD CONSTRAINT `post_tasks_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;