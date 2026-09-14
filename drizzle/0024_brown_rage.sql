ALTER TABLE `helpers` DROP FOREIGN KEY `helpers_contact_event_year_fk`;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` DROP FOREIGN KEY `shift_area_contacts_contact_event_year_fk`;
--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD CONSTRAINT `shift_area_contacts_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;