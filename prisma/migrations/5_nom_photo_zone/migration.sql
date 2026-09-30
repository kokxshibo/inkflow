-- Un seul nom, le prénom et nom du tatoueur : le « nom d'artiste » faisait doublon.
-- S'il était le seul renseigné, il devient le prénom et nom avant d'être retiré.
UPDATE "Settings"
SET "ownerName" = btrim("studioName")
WHERE btrim("ownerName") = '' AND btrim("studioName") NOT IN ('', 'Mon salon');

ALTER TABLE "Settings" DROP COLUMN "studioName";

-- Les variables {{artiste}} (et l'ancienne {{salon}}) deviennent {{tatoueur}}.
-- Elles restent comprises, mais les modèles existants sont mis à jour.
UPDATE "EmailTemplate"
SET "subject" = replace(replace("subject", '{{artiste}}', '{{tatoueur}}'), '{{salon}}', '{{tatoueur}}'),
    "body" = replace(replace("body", '{{artiste}}', '{{tatoueur}}'), '{{salon}}', '{{tatoueur}}')
WHERE "subject" LIKE '%{{artiste}}%' OR "subject" LIKE '%{{salon}}%'
   OR "body" LIKE '%{{artiste}}%' OR "body" LIKE '%{{salon}}%';

UPDATE "Integration"
SET "subject" = replace(replace("subject", '{{artiste}}', '{{tatoueur}}'), '{{salon}}', '{{tatoueur}}'),
    "message" = replace(replace("message", '{{artiste}}', '{{tatoueur}}'), '{{salon}}', '{{tatoueur}}')
WHERE "subject" LIKE '%{{artiste}}%' OR "subject" LIKE '%{{salon}}%'
   OR "message" LIKE '%{{artiste}}%' OR "message" LIKE '%{{salon}}%';

-- Formulaire de demande : photos de la zone à tatouer, à part des références.
ALTER TABLE "ProjectRequest" ADD COLUMN "bodyPhotoUrls" TEXT NOT NULL DEFAULT '[]';
