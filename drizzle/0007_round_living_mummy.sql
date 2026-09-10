CREATE TABLE `shift_area_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL DEFAULT 2026,
	`area` varchar(200) NOT NULL,
	`contactId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shift_area_contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `shift_area_contacts_year_area_unique` UNIQUE(`year`,`area`)
);
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `responsibleContactId` int;--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `responsibleContactName` varchar(200);--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD CONSTRAINT `shift_area_contacts_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;