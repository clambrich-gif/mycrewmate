CREATE TABLE `gpx_tracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL DEFAULT 2026,
	`eventId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(700) NOT NULL,
	`color` varchar(7) NOT NULL DEFAULT '#2563eb',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gpx_tracks_id` PRIMARY KEY(`id`),
	CONSTRAINT `gpx_tracks_event_name_unique` UNIQUE(`eventId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `gpx_tracks` ADD CONSTRAINT `gpx_tracks_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;