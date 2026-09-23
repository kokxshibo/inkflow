# InkFlow 🇨🇭

Application de gestion pour salon de tatouage — **Suisse, tout en CHF**.
Clients, projets, agenda, devis et factures avec **QR-facture suisse**, scan des
factures fournisseurs, et gestion personnelle (AVS, assurance maladie, impôts).

- **Dépôt** : https://github.com/kokxshibo/inkflow
- **Production** : https://inkflow-kokxshibos-projects.vercel.app

> Le périmètre complet et la feuille de route sont dans
> [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md).

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
**Photographie la QR-facture** : le créancier, l'IBAN, le montant, la référence
QRR et, si le fournisseur les encode (Swico S1), le numéro de facture, la date
et le taux de TVA sont extraits automatiquement.

Le décodage se fait **dans le navigateur** (jsQR) : la photo ne part sur le
serveur qu'à l'enregistrement.

Catégories adaptées au métier (encres, aiguilles, consommables, hygiène, loyer,
assurances, formation, déchets…), suivi de l'impôt préalable si assujetti,
justificatifs conservés, charges récurrentes duplicables, répartition annuelle.

### Messagerie
Modèles avec variables `{{prenom}}`, `{{montant}}`, `{{date_rdv}}` remplacées
automatiquement. Rédaction assistée, aperçu, bouton Envoyer, PDF joint.
**Rien ne part sans validation humaine.**

### Demandes (remplace les DM Instagram)
Formulaire public à mettre en bio Instagram. Conversion en client + projet en un
clic, les images de référence suivent.

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

> ⚠️ **Ne jamais afficher de TVA tant que le salon n'est pas inscrit à l'AFC.**
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
`tatoueur@monsalon.ch` / `InkFlow2026!`

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

Réception IMAP et détection automatique des réponses clients, décharges signées,
suivi de cicatrisation automatisé, paiement en ligne TWINT. Détails dans le
cahier des charges.
