-- Le formulaire de demande ne pose plus les questions de taille, rendu, style,
-- budget et disponibilités. Sans réponse, le rendu reste vide au lieu de
-- « Noir & gris » par défaut ; les demandes existantes gardent leurs valeurs.
ALTER TABLE "ProjectRequest" ALTER COLUMN "colorMode" DROP NOT NULL,
ALTER COLUMN "colorMode" DROP DEFAULT;
