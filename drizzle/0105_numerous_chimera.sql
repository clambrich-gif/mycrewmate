CREATE TABLE `task_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(96) NOT NULL,
	`eventId` int NOT NULL,
	`year` int NOT NULL,
	`prepTaskId` int,
	`postTaskId` int,
	`kind` enum('document','receipt') NOT NULL,
	`title` varchar(160) NOT NULL,
	`uploadedByUserId` int,
	`paidByContactId` int,
	`paidByHelperId` int,
	`paidBy` varchar(200),
	`fileName` varchar(200) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`byteSize` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `task_documents` ADD CONSTRAINT `task_documents_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_documents` ADD CONSTRAINT `task_documents_paidByContactId_contacts_id_fk` FOREIGN KEY (`paidByContactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_documents` ADD CONSTRAINT `task_documents_paidByHelperId_helpers_id_fk` FOREIGN KEY (`paidByHelperId`) REFERENCES `helpers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_documents` ADD CONSTRAINT `task_documents_prep_scope_fk` FOREIGN KEY (`prepTaskId`,`eventId`,`year`) REFERENCES `prep_tasks`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_documents` ADD CONSTRAINT `task_documents_post_scope_fk` FOREIGN KEY (`postTaskId`,`eventId`,`year`) REFERENCES `post_tasks`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_documents` ADD CONSTRAINT `task_documents_event_scope_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `task_documents_prep_idx` ON `task_documents` (`tenantId`,`eventId`,`year`,`prepTaskId`);--> statement-breakpoint
CREATE INDEX `task_documents_post_idx` ON `task_documents` (`tenantId`,`eventId`,`year`,`postTaskId`);