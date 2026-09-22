# InkFlow 🇨🇭

Application de gestion pour salon de tatouage — **Suisse, tout en CHF**.
Clients, projets, agenda, devis et factures avec **QR-facture suisse**, messagerie
et formulaire public de demande de projet.

> Lot 1 opérationnel. Le périmètre complet et la feuille de route sont dans
> [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md).

---

## Démarrage rapide

```bash
npm install
npm run setup
npm run dev
```

Puis ouvre http://localhost:3000

**Identifiants de démonstration**

| | |
|---|---|
| E-mail | `tatoueur@monsalon.ch` |
| Mot de passe | `InkFlow2026!` |

> ⚠️ Change ce mot de passe dans **Réglages → Mot de passe** avant toute mise en ligne.

---

## Ce que fait l'application

### Clients
Fiche complète, questionnaire médical (données sensibles nLPD), consentements
séparés (droit à l'image, communications), détection automatique des mineurs,
compteur d'absences, export des données au format JSON pour le droit d'accès.

### Projets
Un client → plusieurs projets → plusieurs séances. Emplacement, taille, style,
galerie d'images classée (référence, maquette, stencil, avant, pendant, après,
cicatrisé), aide au chiffrage basée sur le tarif horaire.

### Agenda
Vues jour, semaine et liste. Détection des chevauchements, trait de l'heure
courante, acomptes liés aux créneaux, statut « provisoire » tant que l'acompte
n'est pas encaissé, marquage des absences qui incrémente le compteur du client.

### Devis
Numérotation séquentielle `DEV-2026-0001`, calcul d'acompte arrondi à 0.05 CHF,
PDF, **lien public d'acceptation en ligne** (horodaté, avec adresse IP),
conversion en facture d'acompte ou en facture complète.

### Factures
Numérotation séquentielle, **QR-facture suisse** conforme SIX sur le PDF,
encaissements multiples (TWINT, espèces, carte, virement), suivi des impayés.
Une facture émise est **figée** : la correction passe par une note de crédit,
conformément à l'obligation de conservation de 10 ans (art. 958f CO).

### Messagerie
Modèles d'e-mails avec variables `{{prenom}}`, `{{montant}}`, `{{date_rdv}}`…
remplacées automatiquement par les données du client. Rédaction assistée,
aperçu, bouton **Envoyer**, PDF joint automatiquement.

**Rien ne part jamais sans validation humaine.** Sans SMTP configuré, les
messages sont archivés et marqués « non envoyés » — impossible d'écrire par
erreur à un vrai client.

### Demandes (remplace les DM Instagram)
Formulaire public à mettre en bio Instagram : description, zone, taille, budget,
disponibilités, jusqu'à 6 images de référence, déclaration de majorité et
consentement. Conversion en client + projet en un clic, les images suivent.

---

## Spécificités suisses

| Point | Implémentation |
|---|---|
| Devise | CHF partout, format `CHF 1'250.00` (`Intl.NumberFormat('de-CH')`) |
| Montants | Stockés en **centimes entiers**, jamais en `float` |
| Arrondi | 0.05 CHF (`roundTo5Cents`) pour les espèces |
| TVA | **Paramètre**, pas une constante. Désactivée par défaut |
| Seuil TVA | Alerte automatique à l'approche de CHF 100'000 de CA glissant |
| QR-facture | `swissqrbill` — QR-IBAN avec référence QRR, ou IBAN standard |
| Validation | IBAN vérifié par mod 97, QR-IBAN par plage IID 30000–31999 |
| Conservation | 10 ans (art. 958f CO) — suppression bloquée hors brouillons |
| Protection des données | nLPD, au niveau d'exigence du RGPD (clientèle frontalière) |

> ⚠️ **Ne jamais afficher de TVA tant que le salon n'est pas inscrit au registre
> de l'AFC.** Le mode TVA se règle dans Réglages → TVA.

> ⚠️ **Tester la QR-facture en conditions réelles** avant la mise en production :
> générer une facture et scanner le PDF avec une vraie application bancaire
> suisse. Une QR-facture mal formée est rejetée par la banque.

---

## Configuration

Copie `.env.example` vers `.env` et complète :

```bash
DATABASE_URL="file:./dev.db"       # SQLite en local
AUTH_SECRET="…"                    # 32 caractères minimum
APP_URL="http://localhost:3000"

SMTP_HOST=""                       # vide = mode hors ligne
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
```

### Envoi d'e-mails

**Ne jamais envoyer directement depuis le VPS** : les IP de VPS sont massivement
blacklistées, tout finirait en indésirables. Il faut un **relais SMTP
transactionnel** :

- **Infomaniak** (suisse, données en Suisse — cohérent avec la nLPD)
- Postmark, Brevo, Scaleway TEM

Et configurer **SPF, DKIM et DMARC** sur le domaine, sinon la délivrabilité est
catastrophique quel que soit le relais.

---

## Pile technique

| Couche | Choix |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Style | Tailwind CSS v4, design system sur variables CSS |
| Animation | Motion (framer-motion) |
| Base de données | Prisma — SQLite en local, PostgreSQL en production |
| Auth | Sessions JWT (jose) + bcrypt, cookie httpOnly |
| PDF | PDFKit + swissqrbill |
| E-mail | Nodemailer |

Aucun `enum` Prisma n'est utilisé : le passage SQLite → PostgreSQL ne demande
que de changer le `provider` dans `prisma/schema.prisma`.

---

## Scripts

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm run start      # serveur de production
npm run setup      # generate + db push + seed
npm run db:studio  # explorateur de base de données
npm run db:seed    # jeu de données de démonstration
```

---

## Structure

```
src/
├── app/
│   ├── (app)/              Application authentifiée
│   │   ├── tableau-de-bord/
│   │   ├── clients/  projets/  agenda/
│   │   ├── devis/  factures/
│   │   ├── messagerie/  demandes/  reglages/
│   ├── demande/            Formulaire public (bio Instagram)
│   ├── devis-public/       Consultation et acceptation client
│   ├── facture-publique/   Consultation client
│   ├── login/
│   └── api/                PDF et recherche globale
├── components/
│   ├── ui/                 Primitives (bouton, champ, carte, dialogue…)
│   ├── app-shell.tsx       Sidebar et barre supérieure
│   ├── command-palette.tsx Recherche globale ⌘K
│   ├── document-form.tsx   Éditeur partagé devis/facture
│   └── document-preview.tsx
└── lib/
    ├── money.ts            CHF, arrondi 5 ct, TVA, IBAN, référence QRR
    ├── pdf.ts              Génération PDF + QR-facture
    ├── mail.ts             SMTP et variables de modèles
    ├── db.ts               Prisma, réglages, numérotation séquentielle
    ├── auth.ts             Sessions
    ├── constants.ts        Libellés métier
    └── utils.ts            Dates, formatage, helpers
```

---

## Raccourcis clavier

| | |
|---|---|
| `⌘K` / `Ctrl+K` | Recherche globale |
| `⌘B` / `Ctrl+B` | Réduire la barre latérale |
| `Esc` | Fermer une fenêtre |

---

## Passage en production (VPS)

1. **Base de données** : passer `provider = "postgresql"` dans le schéma Prisma,
   puis `prisma migrate deploy`.
2. **Secrets** : générer un vrai `AUTH_SECRET`, renseigner le SMTP, définir
   `APP_URL` sur le domaine.
3. **Reverse proxy** : Caddy ou Traefik pour le HTTPS automatique.
4. **Fichiers** : `public/uploads/` doit être persisté (volume Docker).
5. **Sauvegardes** : quotidiennes, chiffrées, hors du VPS — et **restauration
   testée**. Une sauvegarde jamais restaurée n'est pas une sauvegarde.
6. **Mot de passe** : le changer avant la première mise en ligne.

---

## Reste à faire (lot 2)

Réception IMAP, rattachement automatique des réponses aux fiches clients,
détection « le client a répondu », rappels et relances automatiques, décharges
signées, suivi de cicatrisation automatisé. Détails dans le cahier des charges.
