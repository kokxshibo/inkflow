-- Suivi des conversations Instagram / Gmail : dernier message reçu, dernière lecture.
ALTER TABLE "Lead" ADD COLUMN "lastIncomingAt" TIMESTAMP(3),
ADD COLUMN "lastReadAt" TIMESTAMP(3);

UPDATE "Lead" AS lead
SET "lastIncomingAt" = (
    SELECT max(message."sentAt")
    FROM "LeadMessage" AS message
    WHERE message."leadId" = lead."id" AND message."direction" = 'in'
);

-- L'app est personnelle au tatoueur : la variable {{salon}} devient {{artiste}}
-- (l'ancienne reste comprise, mais les modèles existants sont mis à jour).
UPDATE "EmailTemplate"
SET "subject" = replace("subject", '{{salon}}', '{{artiste}}'),
    "body" = replace(
        replace("body", '{{salon}}', '{{artiste}}'),
        'une vraie différence pour le salon',
        'une vraie différence pour moi'
    )
WHERE "subject" LIKE '%{{salon}}%' OR "body" LIKE '%{{salon}}%'
   OR "body" LIKE '%une vraie différence pour le salon%';

UPDATE "Integration"
SET "subject" = replace("subject", '{{salon}}', '{{artiste}}'),
    "message" = replace("message", '{{salon}}', '{{artiste}}')
WHERE "subject" LIKE '%{{salon}}%' OR "message" LIKE '%{{salon}}%';
