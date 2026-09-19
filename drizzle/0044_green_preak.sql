ALTER TABLE `cakes` ADD `locationId` int;--> statement-breakpoint
ALTER TABLE `cakes` ADD `dropoffDate` varchar(10) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cakes` ADD `dropoffTimeStructured` varchar(5) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cakes` ADD CONSTRAINT `cakes_locationId_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;