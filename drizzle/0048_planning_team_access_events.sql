CREATE TABLE `planning_team_access_events` (
`accessId` int NOT NULL,
`eventId` int NOT NULL,
CONSTRAINT `planning_team_access_event_unique` UNIQUE(`accessId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `planning_team_accesses` (
`id` int AUTO_INCREMENT NOT NULL,
`label` varchar(120) NOT NULL,
`passwordHash` varchar(255) NOT NULL,
`sessionVersion` int NOT NULL DEFAULT 1,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `planning_team_accesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `planning_team_access_events` ADD CONSTRAINT `pta_events_access_fk` FOREIGN KEY (`accessId`) REFERENCES `planning_team_accesses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planning_team_access_events` ADD CONSTRAINT `pta_events_event_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `planning_team_access_events_event_idx` ON `planning_team_access_events` (`eventId`);--> statement-breakpoint
-- Bestehende Installationen mit dem früheren globalen Planungsteam-Passwort
-- erhalten einmalig einen klar bezeichneten Zugang mit Freigabe für alle
-- bereits vorhandenen Veranstaltungen. Die Passwortdaten bleiben bcrypt-gehasht.
INSERT INTO `planning_team_accesses` (`label`, `passwordHash`, `sessionVersion`)
SELECT 'Übernommener Planungsteam-Zugang', `passwordHash`, COALESCE(NULLIF(`planningTeamSessionVersion`, 0), 1)
FROM `security_settings`
WHERE `passwordHash` IS NOT NULL
  AND `passwordHash` <> ''
  AND NOT EXISTS (SELECT 1 FROM `planning_team_accesses`);--> statement-breakpoint
INSERT INTO `planning_team_access_events` (`accessId`, `eventId`)
SELECT `planning_team_accesses`.`id`, `events`.`id`
FROM `planning_team_accesses`
CROSS JOIN `events`
WHERE `planning_team_accesses`.`label` = 'Übernommener Planungsteam-Zugang';
