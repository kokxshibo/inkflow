# InkFlow 🇨🇭

Application de gestion pour tatoueur indépendant — **Suisse, tout en CHF**.
Clients, projets, agenda, devis et factures avec **QR-facture suisse**, scan des
factures fournisseurs, et gestion personnelle (AVS, assurance maladie, impôts).

- **Dépôt** : https://github.com/kokxshibo/inkflow
- **Production (VPS)** : https://inkflow.51-83-74-6.sslip.io
- **Ancienne instance (Vercel)** : https://inkflow-kokxshibos-projects.vercel.app

> Le périmètre complet et la feuille de route sont dans
> [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md).

---

## 🖥️ Hébergement sur le VPS

L'application tourne sur le VPS OVH, à côté des autres services, avec une
empreinte réduite : le build autonome de Next (≈ 100 Mo), un service limité à
768 Mo de mémoire, la base dans le PostgreSQL déjà installé.

| Élément | Emplacement |
|---|---|
| Application | `/opt/inkflow/current` (les 2 dernières versions sont gardées) |
| Configuration et secrets | `/opt/inkflow/inkflow.env` |
| Fichiers envoyés | `/var/lib/inkflow/uploads`, servis par nginx |
| Service | `inkflow.service` (port 3010, fuseau Europe/Zurich) |
| Relève Gmail | `inkflow-sync.timer`, chaque minute |
| Sauvegarde | `inkflow-backup.timer`, chaque nuit dans `/opt/sauvegardes/inkflow` (30 jours) |

**Mettre à jour** après un commit, depuis Git Bash :

```bash
bash deploy/deploy.sh
```

Le code est envoyé, compilé sur le VPS sous l'utilisateur `inkflow`, les
migrations sont appliquées, puis le service redémarre. Les dépendances de
compilation sont supprimées à la fin.

**Première installation** (déjà faite) : `sudo bash deploy/setup-vps.sh <domaine>`
sur le VPS crée l'utilisateur, la base, les secrets, les services, le site nginx
et le certificat HTTPS. Le compte propriétaire se crée ensuite via
`/bienvenue?cle=<SETUP_TOKEN>` (clé dans `inkflow.env`) : sans la clé, personne
d'autre ne peut le créer avant toi.

Journal en cas de souci : `journalctl -u inkflow -n 100`.

---

## ⚡ Mise en service sur Vercel — 3 étapes

Le code est déployé, mais deux services doivent être branchés depuis le
tableau de bord Vercel (l'API ne permet pas de les créer).

### 1. La base de données

Vercel → projet **inkflow** → **Storage** → **Create Database** → **Neon**
(Postgres) → région **Frankfurt** ou **Paris** → **Connect to Project**.

Vercel injecte automatiquement `DATABASE_URL` et `DATABASE_URL_UNPOOLED`.
Les migrations s'appliquent toutes seules au déploiement suivant.

### 2. Le stockage des fichiers

Vercel → **Storage** → **Create** → **Blob** → **Connect to Project**.

Injecte `BLOB_READ_WRITE_TOKEN`. Sans lui, tout fonctionne sauf l'envoi de
photos (justificatifs de dépenses, images de projets).

### 3. Redéployer

Vercel → **Deployments** → menu du dernier déploiement → **Redeploy**.

Puis ouvre l'application : la page **/bienvenue** s'affiche pour créer ton
compte. Elle se ferme définitivement ensuite.

---

## 📱 Installer sur iPhone

1. Ouvrir l'adresse dans **Safari** (pas Chrome — l'installation ne marche que depuis Safari)
2. Bouton **Partager** → **Sur l'écran d'accueil**
3. L'app s'ouvre en plein écran, sans barre d'adresse, avec son icône

Ce qui est prévu pour iOS :

- Barre d'onglets en bas, à portée de pouce
- Gestion des encoches et de la barre gestuelle (`safe-area-inset`)
- Champs à 16 px : Safari ne zoome plus à la saisie
- Cibles tactiles de 44 px minimum
- Appareil photo natif pour scanner les factures
- **Connexion persistante 90 jours** : plus besoin de se reconnecter

---

## Ce que fait l'application

### Clients
Fiche complète, questionnaire médical (données sensibles nLPD), consentements
séparés, détection automatique des mineurs, compteur d'absences, export des
données au format JSON pour le droit d'accès.

### Projets
Un client → plusieurs projets → plusieurs séances. Emplacement, taille, style,
galerie classée (référence, maquette, stencil, avant, pendant, après, cicatrisé),
aide au chiffrage basée sur le tarif horaire.

### Agenda
Vues jour, semaine et liste. Détection des chevauchements, trait de l'heure
courante, acomptes liés aux créneaux, statut « provisoire » tant que l'acompte
n'est pas encaissé, marquage des absences.

### Devis
**Devis express** : on choisit le projet, le prix est proposé (séances × heures ×
tarif horaire, prix minimum respecté), on ajuste si besoin, puis « Créer » ou
« Créer et envoyer ». Numérotation séquentielle `DEV-2026-0001`, acompte arrondi
à 0.05 CHF, PDF, **lien public d'acceptation en ligne** horodaté. Le formulaire
détaillé (plusieurs lignes, remise) reste accessible.

### Factures clients
**Facturation automatique** : l'écran « Que veux-tu facturer ? » liste ce qui est
dû, montant déjà calculé et expliqué — acompte d'un devis accepté, séance
effectuée (reste du prix convenu réparti sur les séances restantes, ou durée ×
tarif horaire), solde du projet. On confirme, on indique si c'est déjà encaissé,
c'est émis. Rien n'est facturé deux fois : chaque séance est rattachée à sa
facture. « Facturer » apparaît aussi dans l'agenda (séance marquée effectuée),
sur la fiche projet, sur le devis accepté et sur le tableau de bord.

Numérotation séquentielle, **QR-facture suisse** conforme SIX sur le PDF,
encaissements (TWINT, espèces, carte, virement), suivi des impayés.
Une facture émise est **figée** : la correction passe par une note de crédit
(conservation 10 ans, art. 958f CO).

### Dépenses et factures fournisseurs 📸
**Scanner de documents** : caméra avec cadre, détection automatique de la page,
coins ajustables, redressement de la perspective et filtre couleur ou noir et
blanc. La QR-facture est lue dans le navigateur (jsQR), puis **Gemini Flash**
lit le document (fournisseur, dates, lignes, TVA, total). On vérifie la version
numérisée à côté du scan, on corrige si besoin, puis « Valider et enregistrer ».
Le scan reste joint à la dépense. Clé Gemini : Réglages → Connexions.

Factures et dépenses se suivent **par semaine, mois, trimestre, année** ou sur
une période choisie, avec graphique.

Catégories adaptées au métier (encres, aiguilles, consommables, hygiène, loyer,
assurances, formation, déchets…), suivi de l'impôt préalable si assujetti,
justificatifs conservés, charges récurrentes duplicables, répartition annuelle.

### Messagerie
Modèles avec variables `{{prenom}}`, `{{montant}}`, `{{date_rdv}}` remplacées
automatiquement. Rédaction assistée, aperçu, bouton Envoyer, PDF joint.
**Rien ne part sans validation humaine.**

### Demandes (remplace les DM Instagram)
Formulaire public à mettre en bio Instagram, en français, allemand ou anglais.
Le client écrit librement où il veut son tatouage et **prend en photo la zone**
juste en dessous (3 photos maximum, allégées sur son téléphone avant l'envoi),
puis décrit son idée et ajoute ses images d'inspiration. Conversion en client +
projet en un clic : les photos de la zone rejoignent la galerie en « Avant », les
images de référence suivent aussi.

**Réponses automatiques Instagram et Gmail** (Réglages → Connexions) : quand une
nouvelle personne écrit au sujet d'un tatouage (mots-clés réglables) et qu'on ne
lui a encore jamais répondu, elle reçoit une seule fois un petit message perso
avec **son propre lien de demande** (`/d/<jeton>`). On voit ensuite dans
*Demandes* qui a cliqué et combien de fois, d'où la personne vient, sa **photo de
profil et son @pseudo Instagram** (cliquable), et toute la conversation — y
compris les réponses envoyées depuis le téléphone. Le formulaire s'ouvre
pré-rempli. Les newsletters, notifications et clients existants sont ignorés.

**Répondre depuis l'app** : dans la fiche du contact (ou de sa demande), le
message écrit part tout seul sur le bon canal — message privé Instagram ou e-mail
dans le même fil Gmail, signature ajoutée. La liste « Conversations » signale les
non-lus et ce qui attend une réponse ; le badge *Demandes* du menu les compte.
Instagram n'accepte une réponse que dans les 24 h qui suivent le dernier message de la personne.

- **Gmail** : mot de passe d'application Google (IMAP + SMTP), relève chaque minute.
- **Instagram** : compte professionnel + application Meta (API officielle,
  webhook). Pour répondre à tout le monde, l'app Meta doit être en mode Live avec
  l'accès avancé à `instagram_business_manage_messages`.

### Gestion personnelle 🇨🇭
| Module | Contenu |
|---|---|
| **AVS / AI / APG** | Caisse, n° d'affilié, revenu annoncé, taux, frais administratifs, acomptes trimestriels générés automatiquement |
| **Assurance maladie** | Assureur, prime, subside, franchise. **Suivi automatique de la franchise et de la quote-part** au fil des frais médicaux saisis |
| **Impôts** | Canton, commune, acomptes, résultat estimé (encaissé moins charges) |
| **Provisions** | Un % de chaque encaissement mis de côté pour l'AVS et les impôts, avec comparaison à ce qui a déjà été versé |

> Ces chiffres servent à provisionner et à ne rien oublier. Ils ne remplacent ni
> la caisse de compensation, ni l'assureur, ni la fiduciaire.

---

## Spécificités suisses

| Point | Implémentation |
|---|---|
| Devise | CHF partout, format `CHF 1'250.00` (`Intl.NumberFormat('de-CH')`) |
| Montants | Stockés en **centimes entiers**, jamais en `float` |
| Arrondi | 0.05 CHF pour les espèces |
| TVA | **Paramètre**, désactivée par défaut. Taux normal 8.1 % |
| Seuil TVA | Alerte à l'approche de CHF 100'000 de CA glissant |
| QR-facture | Émission (`swissqrbill`) **et lecture** (`jsQR` + décodage SPC) |
| Validation | IBAN par mod 97, QR-IBAN par plage IID 30000–31999 |
| AVS | Taux maximal 10 % (8.1 AVS + 1.4 AI + 0.5 APG) + frais de caisse |
| LAMal | Franchises 300 → 2'500, quote-part 10 % plafonnée à CHF 700/an |
| Conservation | 10 ans (art. 958f CO) |
| Protection des données | nLPD, au niveau d'exigence du RGPD |

> ⚠️ **Ne jamais afficher de TVA tant que l'activité n'est pas inscrite à l'AFC.**
> ⚠️ **Tester la QR-facture** en scannant un PDF généré avec une vraie
> application bancaire suisse avant la mise en production.
> ⚠️ Les taux AVS, plafonds LAMal et barèmes fiscaux **changent chaque année** :
> ce sont des valeurs par défaut modifiables, à confirmer avec les organismes.

---

## Développement local

```bash
npm install
cp .env.example .env    # renseigner DATABASE_URL et AUTH_SECRET
npm run setup           # migrations + jeu de données de démonstration
npm run dev
```

Il faut un PostgreSQL. Le plus simple : réutiliser l'URL de la base Neon
créée pour Vercel (onglet **Storage** → `.env.local`).

Le seed crée un compte de démonstration :
`tatoueur@exemple.ch` / `InkFlow2026!`

En production, pas de seed : la page **/bienvenue** crée le compte propriétaire.

---

## Pile technique

| Couche | Choix |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Style | Tailwind CSS v4, design system sur variables CSS |
| Animation | Motion |
| Base de données | Prisma + PostgreSQL (Neon) |
| Auth | Session JWT glissante (jose) + bcrypt, vérifiée en middleware Edge |
| PDF | PDFKit + swissqrbill |
| Scan QR | jsQR, décodage côté navigateur |
| Fichiers | Vercel Blob en production, disque en local |
| E-mail | Nodemailer via relais transactionnel |

---

## Scripts

```bash
npm run dev        # serveur de développement
npm run build      # migrations + build de production
npm run setup      # generate + migrate + seed
npm run db:dev     # créer une migration après modification du schéma
npm run db:studio  # explorateur de base de données
```

---

## Envoi d'e-mails

**Ne jamais envoyer directement depuis le serveur** : les IP sont blacklistées,
tout finirait en indésirables. Utiliser un **relais SMTP transactionnel** :

- **Infomaniak** (suisse, données en Suisse — cohérent avec la nLPD)
- Postmark, Brevo, Scaleway TEM

Puis configurer **SPF, DKIM et DMARC** sur le domaine, et renseigner
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` dans Vercel.

Sans SMTP, les messages sont archivés et marqués « non envoyés » — impossible
d'écrire par erreur à un vrai client.

---

## Raccourcis clavier

| | |
|---|---|
| `⌘K` / `Ctrl+K` | Recherche globale |
| `⌘B` / `Ctrl+B` | Réduire la barre latérale |
| `Esc` | Fermer une fenêtre |

---

## Reste à faire

Réception IMAP de la messagerie générale (hors demandes), décharges signées,
suivi de cicatrisation automatisé, paiement en ligne TWINT. Détails dans le
cahier des charges.
