CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL DEFAULT 2026,
	`eventId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_event_name_unique` UNIQUE(`eventId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `locationId` int;--> statement-breakpoint
ALTER TABLE `shifts` ADD `locationId` int;--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD CONSTRAINT `prep_tasks_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;