-- Frühere Präsenzdaten waren global und nur zehn Minuten relevant. Sie bleiben
-- technisch erhalten, erhalten aber bewusst keinen Vereinsbezug und können
-- deshalb in keinem Vereinszähler auftauchen.
ALTER TABLE `session_presences` ADD `tenantId` varchar(96);--> statement-breakpoint
UPDATE `session_presences` SET `tenantId` = '__legacy_unscoped__' WHERE `tenantId` IS NULL;--> statement-breakpoint
ALTER TABLE `session_presences` MODIFY COLUMN `tenantId` varchar(96) NOT NULL;--> statement-breakpoint
ALTER TABLE `session_presences` ADD `presenceRole` enum('planner','primary_admin','co_admin') DEFAULT 'planner' NOT NULL;--> statement-breakpoint
CREATE INDEX `session_presences_tenant_role_last_seen_idx` ON `session_presences` (`tenantId`,`presenceRole`,`lastSeen`);
