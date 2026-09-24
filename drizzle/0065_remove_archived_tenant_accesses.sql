-- Archivierte Vereine bewahren ausschließlich ihre fachlichen Planungsdaten.
-- Jede persönliche Zugangs- und Berechtigungsbeziehung wird vollständig entfernt,
-- sodass eine spätere Reaktivierung zwingend mit neu vergebenen Zugängen beginnt.

-- Zuerst werden noch offene Übergaben und Aktivierungen entfernt.
DELETE FROM `platform_tenant_handoffs`
WHERE `tenantId` IN (
  SELECT `id` FROM `tenants` WHERE `status` = 'archived'
);--> statement-breakpoint

-- Auch parallel offene Browser-Sitzungen werden sofort entwertet.
INSERT INTO `revoked_sessions` (`sessionKey`, `reason`, `revokedAt`)
SELECT `presence`.`sessionKey`, 'security_reset', NOW()
FROM `session_presences` AS `presence`
INNER JOIN `tenants` AS `tenant`
  ON `tenant`.`id` = `presence`.`tenantId`
WHERE `tenant`.`status` = 'archived'
ON DUPLICATE KEY UPDATE
  `reason` = VALUES(`reason`),
  `revokedAt` = VALUES(`revokedAt`);--> statement-breakpoint

DELETE `presence`
FROM `session_presences` AS `presence`
INNER JOIN `tenants` AS `tenant`
  ON `tenant`.`id` = `presence`.`tenantId`
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint

DELETE FROM `planning_team_invitations`
WHERE `tenantId` IN (
  SELECT `id` FROM `tenants` WHERE `status` = 'archived'
);--> statement-breakpoint

DELETE FROM `tenant_admin_invitations`
WHERE `tenantId` IN (
  SELECT `id` FROM `tenants` WHERE `status` = 'archived'
);--> statement-breakpoint

-- Die Zugangstabellen werden gelöscht, bevor Planungsdaten erhalten bleiben.
-- Die Kaskade entfernt eventbezogene Freigaben und ggf. verbliebene Einladungen.
DELETE `access`
FROM `planning_team_accesses` AS `access`
INNER JOIN `planning_team_access_events` AS `access_event`
  ON `access_event`.`accessId` = `access`.`id`
INNER JOIN `events` AS `event`
  ON `event`.`id` = `access_event`.`eventId`
INNER JOIN `tenants` AS `tenant`
  ON `tenant`.`id` = `event`.`tenantId`
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint

-- Jede Mandantenmitgliedschaft des Archivvereins erlischt vollständig.
DELETE `membership`
FROM `user_tenant_memberships` AS `membership`
INNER JOIN `tenants` AS `tenant`
  ON `tenant`.`id` = `membership`.`tenantId`
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint

-- Persönliche Vereinsadmin-Konten ohne verbleibende Vereinsmitgliedschaft
-- dürfen nicht als ungenutzte Passwortkonten oder E-Mail-Blocker fortbestehen.
DELETE `credential`
FROM `tenant_admin_credentials` AS `credential`
LEFT JOIN `user_tenant_memberships` AS `membership`
  ON `membership`.`userId` = `credential`.`userId`
WHERE `membership`.`userId` IS NULL;--> statement-breakpoint

DELETE `user`
FROM `users` AS `user`
LEFT JOIN `user_tenant_memberships` AS `membership`
  ON `membership`.`userId` = `user`.`id`
WHERE (
    `user`.`openId` LIKE 'planning-team-access-%'
    OR `user`.`openId` LIKE 'tenant-admin:%'
  )
  AND `membership`.`userId` IS NULL;--> statement-breakpoint
