ALTER TABLE `events` ADD `pdfLogoKey` varchar(500);--> statement-breakpoint
ALTER TABLE `events` ADD `pdfLogoUrl` varchar(700);--> statement-breakpoint
UPDATE `events` AS `event`
INNER JOIN `app_settings` AS `settings`
  ON `settings`.`id` = 1
  -- Ältere Tabellen können aus MySQL-/MariaDB-Installationen mit verschiedenen
  -- utf8mb4-Kollationen stammen. Der Abgleich ist hier ausschließlich eine
  -- exakte Zuordnung der einen App-Einstellung zum gleichnamigen Event.
  -- Binäre Vergleiche vermeiden daher eine serverweite Kollationsänderung.
  AND CONVERT(`event`.`name` USING BINARY) = CONVERT(`settings`.`eventName` USING BINARY)
  AND CONVERT(CAST(`event`.`year` AS CHAR) USING BINARY) = CONVERT(`settings`.`eventYear` USING BINARY)
SET
  `event`.`pdfLogoKey` = `settings`.`logoKey`,
  `event`.`pdfLogoUrl` = `settings`.`logoUrl`
WHERE `settings`.`logoKey` IS NOT NULL OR `settings`.`logoUrl` IS NOT NULL;
