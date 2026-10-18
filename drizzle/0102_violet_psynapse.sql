CREATE TABLE `post_task_helpers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postTaskId` int NOT NULL,
	`helperId` int NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`slot` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_task_helpers_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_task_helpers_task_slot_unique` UNIQUE(`postTaskId`,`slot`),
	CONSTRAINT `post_task_helpers_task_helper_unique` UNIQUE(`postTaskId`,`helperId`)
);
--> statement-breakpoint
CREATE TABLE `prep_task_helpers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prepTaskId` int NOT NULL,
	`helperId` int NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`slot` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prep_task_helpers_id` PRIMARY KEY(`id`),
	CONSTRAINT `prep_task_helpers_task_slot_unique` UNIQUE(`prepTaskId`,`slot`),
	CONSTRAINT `prep_task_helpers_task_helper_unique` UNIQUE(`prepTaskId`,`helperId`)
);
--> statement-breakpoint
ALTER TABLE `post_tasks` ADD CONSTRAINT `post_tasks_id_event_year_unique` UNIQUE(`id`,`eventId`,`year`);--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD CONSTRAINT `prep_tasks_id_event_year_unique` UNIQUE(`id`,`eventId`,`year`);--> statement-breakpoint
ALTER TABLE `post_task_helpers` ADD CONSTRAINT `post_task_helpers_task_event_year_fk` FOREIGN KEY (`postTaskId`,`eventId`,`year`) REFERENCES `post_tasks`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_task_helpers` ADD CONSTRAINT `post_task_helpers_helper_event_year_fk` FOREIGN KEY (`helperId`,`eventId`,`year`) REFERENCES `helpers`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prep_task_helpers` ADD CONSTRAINT `prep_task_helpers_task_event_year_fk` FOREIGN KEY (`prepTaskId`,`eventId`,`year`) REFERENCES `prep_tasks`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prep_task_helpers` ADD CONSTRAINT `prep_task_helpers_helper_event_year_fk` FOREIGN KEY (`helperId`,`eventId`,`year`) REFERENCES `helpers`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `post_task_helpers_event_year_helper_idx` ON `post_task_helpers` (`eventId`,`year`,`helperId`);--> statement-breakpoint
CREATE INDEX `prep_task_helpers_event_year_helper_idx` ON `prep_task_helpers` (`eventId`,`year`,`helperId`);--> statement-breakpoint
INSERT INTO `post_task_helpers` (`postTaskId`, `helperId`, `year`, `eventId`, `slot`)
SELECT `id`, `helperId`, `year`, `eventId`, 1 FROM `post_tasks`
WHERE `helperId` IS NOT NULL;--> statement-breakpoint
INSERT INTO `prep_task_helpers` (`prepTaskId`, `helperId`, `year`, `eventId`, `slot`)
SELECT `id`, `helperId`, `year`, `eventId`, 1 FROM `prep_tasks`
WHERE `helperId` IS NOT NULL AND `eventPassResponsibleHelperId` IS NULL;
