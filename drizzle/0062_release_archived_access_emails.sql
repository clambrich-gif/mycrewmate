-- Archivierte Vereine behalten ihre Planungsdaten, aber keine verwendbaren
-- persönlichen Zugangsdaten oder offenen Aktivierungslinks.
UPDATE `planning_team_invitations` AS `invitation`
INNER JOIN `tenants` AS `tenant` ON `tenant`.`id` = `invitation`.`tenantId`
SET `invitation`.`usedAt` = COALESCE(`invitation`.`usedAt`, NOW())
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint
UPDATE `tenant_admin_invitations` AS `invitation`
INNER JOIN `tenants` AS `tenant` ON `tenant`.`id` = `invitation`.`tenantId`
SET `invitation`.`usedAt` = COALESCE(`invitation`.`usedAt`, NOW())
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint
UPDATE `planning_team_accesses` AS `access`
INNER JOIN `planning_team_access_events` AS `access_event`
  ON `access_event`.`accessId` = `access`.`id`
INNER JOIN `events` AS `event`
  ON `event`.`id` = `access_event`.`eventId`
INNER JOIN `tenants` AS `tenant`
  ON `tenant`.`id` = `event`.`tenantId`
SET `access`.`email` = NULL,
    `access`.`mustChangePassword` = true,
    `access`.`sessionVersion` = `access`.`sessionVersion` + 1
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint
UPDATE `user_tenant_memberships` AS `membership`
INNER JOIN `tenants` AS `tenant` ON `tenant`.`id` = `membership`.`tenantId`
SET `membership`.`status` = 'suspended',
    `membership`.`isDefault` = false
WHERE `tenant`.`status` = 'archived';--> statement-breakpoint
UPDATE `tenant_admin_credentials` AS `credential`
SET `credential`.`email` = CONCAT('archivierter-zugang-', `credential`.`userId`, '@invalid.local'),
    `credential`.`status` = 'suspended',
    `credential`.`mustChangePassword` = true,
    `credential`.`sessionVersion` = `credential`.`sessionVersion` + 1
WHERE `credential`.`status` = 'active'
  AND EXISTS (
    SELECT 1
    FROM `user_tenant_memberships` AS `archived_membership`
    INNER JOIN `tenants` AS `archived_tenant`
      ON `archived_tenant`.`id` = `archived_membership`.`tenantId`
    WHERE `archived_membership`.`userId` = `credential`.`userId`
      AND `archived_membership`.`role` = 'tenant_admin'
      AND `archived_tenant`.`status` = 'archived'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `user_tenant_memberships` AS `active_membership`
    INNER JOIN `tenants` AS `active_tenant`
      ON `active_tenant`.`id` = `active_membership`.`tenantId`
    WHERE `active_membership`.`userId` = `credential`.`userId`
      AND `active_membership`.`role` = 'tenant_admin'
      AND `active_membership`.`status` = 'active'
      AND `active_tenant`.`status` NOT IN ('suspended', 'archived')
  );
