ALTER TABLE `events` ADD `pdfLogoKey` varchar(500);--> statement-breakpoint
ALTER TABLE `events` ADD `pdfLogoUrl` varchar(700);--> statement-breakpoint
UPDATE `events` AS `event`
INNER JOIN `app_settings` AS `settings`
  ON `settings`.`id` = 1
  AND `event`.`name` = `settings`.`eventName`
  AND CAST(`event`.`year` AS CHAR) = `settings`.`eventYear`
SET
  `event`.`pdfLogoKey` = `settings`.`logoKey`,
  `event`.`pdfLogoUrl` = `settings`.`logoUrl`
WHERE `settings`.`logoKey` IS NOT NULL OR `settings`.`logoUrl` IS NOT NULL;
