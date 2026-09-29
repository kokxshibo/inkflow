-- Langue choisie sur le formulaire de demande (fr | de | en).
ALTER TABLE "ProjectRequest" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fr';

-- Version numérisée par l'IA d'une facture scannée (JSON), gardée à côté du scan.
ALTER TABLE "Expense" ADD COLUMN "scanData" TEXT;

-- Nouveau message automatique : français puis anglais, un seul lien à la fin.
UPDATE "Integration"
SET "message" = 'Salut à toi, merci de me contacter et de l’intérêt que tu portes à mon travail. Afin de centraliser toutes les demandes de projet provenant de différentes plateformes, je t’incite à répondre au questionnaire en cliquant sur le lien ci-dessous. Je te répondrai dans les plus brefs délais ! Merci d’avance.

Hi there, thank you for reaching out and for your interest in my work. To keep all project requests from the different platforms in one place, I invite you to fill in the questionnaire by clicking the link below. I’ll get back to you as soon as possible! Thanks in advance.

👉 {{lien}}'
WHERE "channel" = 'instagram';

UPDATE "Integration"
SET "message" = 'Salut à toi, merci de me contacter et de l’intérêt que tu portes à mon travail. Afin de centraliser toutes les demandes de projet provenant de différentes plateformes, je t’incite à répondre au questionnaire en cliquant sur le lien ci-dessous. Je te répondrai dans les plus brefs délais ! Merci d’avance.

Hi there, thank you for reaching out and for your interest in my work. To keep all project requests from the different platforms in one place, I invite you to fill in the questionnaire by clicking the link below. I’ll get back to you as soon as possible! Thanks in advance.

👉 {{lien}}

{{signature}}'
WHERE "channel" = 'gmail';
