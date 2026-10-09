ALTER TABLE `pilot_inquiries` ADD `organizationType` varchar(120);--> statement-breakpoint
ALTER TABLE `pilot_inquiries` ADD `eligibilityConfirmedAt` timestamp;--> statement-breakpoint
UPDATE `pilot_inquiries`
SET
  `organizationType` = COALESCE(`organizationType`, 'Verein oder Verband'),
  `eligibilityConfirmedAt` = COALESCE(`eligibilityConfirmedAt`, `privacyAcceptedAt`, `createdAt`, CURRENT_TIMESTAMP);--> statement-breakpoint
ALTER TABLE `pilot_inquiries` MODIFY `organizationType` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_inquiries` MODIFY `eligibilityConfirmedAt` timestamp NOT NULL;
