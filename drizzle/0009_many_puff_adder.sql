ALTER TABLE `approvals` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `cakes` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `finances` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `helpers` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `post_tasks` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `prep_tasks` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_area_contacts` MODIFY COLUMN `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` MODIFY COLUMN `eventId` int NOT NULL;