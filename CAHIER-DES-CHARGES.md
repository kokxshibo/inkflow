# Cahier des charges — Application de gestion pour salon de tatouage

> Document de cadrage. Objectif : lister **tout** avant de coder, puis découper en lots.
> Statut : 🟡 en cours de validation
> Contexte : 🇨🇭 **Suisse — tout en CHF**, tatoueur indépendant seul
> Dernière MAJ : 2026-09-22

---

## 0. Contexte & objectif

Application web unique permettant à un tatoueur de gérer 100 % de son activité :
clients, projets, rendez-vous, devis, factures, encaissements, **e-mails (envoi + réception)**,
consentements, stock, compta et statistiques.

**Contraintes structurantes**
- Accessible partout (desktop + mobile), hébergée sur un **VPS** perso.
- Nom de domaine dédié + **adresses e-mail pro** gérées depuis l'app.
- Le tatoueur bosse debout, les mains prises → **mobile-first**, peu de clics.
- Données médicales & photos → **nLPD suisse** (voir §16).

### 🇨🇭 Cadre : Suisse
| Paramètre | Valeur |
|---|---|
| Devise | **CHF** partout (jamais d'euro) |
| Format des montants | `CHF 1'250.00` — apostrophe pour les milliers, **point** pour les décimales |
| Arrondi | **0.05 CHF** (5 centimes) pour les paiements en espèces |
| TVA | Taux normal **8.1 %** (tatouage). Réduit 2.6 %, hébergement 3.8 % — non applicables ici |
| Seuil d'assujettissement TVA | **CHF 100'000** de CA annuel. En dessous → **pas de TVA du tout** sur les factures |
| Paiement de facture | **QR-facture** (Swiss QR-bill) obligatoire de fait |
| Paiement instantané | **TWINT** — incontournable en Suisse, à prioriser sur la CB |
| Protection des données | **nLPD / revDSG** (et RGPD en plus si clientèle UE) |
| Conservation comptable | **10 ans** (art. 958f CO) |
| Cotisations sociales | **AVS/AI/APG** via la caisse de compensation |
| Réglementation tatouage | Cantonale — chimiste cantonal / service de la santé publique |
| Domaine | `.ch` |
| Langue | FR (Romandie) — prévoir DE et EN selon la clientèle |

> ⚠️ **Le mode TVA doit être un paramètre, pas une constante.** Tant que le CA reste sous CHF 100'000, il n'est **pas** assujetti et les factures ne doivent afficher **aucune TVA** (l'afficher sans être assujetti est une faute). L'app doit gérer les deux cas et surveiller le franchissement du seuil.

---

## 1. Clients (CRM)

### 1.1 Fiche client
- [ ] Identité : nom, prénom, pseudo / **@Instagram**, e-mail, téléphone
- [ ] Date de naissance → calcul auto **majeur / mineur** (bloque la prise de RDV si mineur sans autorisation)
- [ ] Adresse postale complète (obligatoire pour la facture)
- [ ] Photo / avatar (facultatif)
- [ ] Langue préférée (FR / DE / EN) → mails, devis et factures partent dans la bonne langue
- [ ] Source d'acquisition : Instagram, bouche-à-oreille, Google, TikTok, walk-in, convention, parrainage
- [ ] Statut : prospect / client actif / inactif / archivé / **liste rouge** (no-show répétés)
- [ ] Tags libres : style préféré, VIP, fidèle, "paie toujours en retard", etc.
- [ ] Notes privées du tatoueur (non visibles du client)
- [ ] Identité vérifiée le ___ par ___ (case à cocher — **ne pas stocker la copie de la CNI**, voir §16)

### 1.2 Questionnaire médical (données sensibles)
- [ ] Allergies : latex, nickel, encres, anesthésiants, pansements
- [ ] Traitements en cours (anticoagulants, roaccutane, immunosuppresseurs…)
- [ ] Diabète, hémophilie, épilepsie, problèmes cardiaques
- [ ] Grossesse / allaitement
- [ ] Tendance aux **chéloïdes**, psoriasis, eczéma
- [ ] Hépatite / VIH (à débattre : utile pour l'hygiène renforcée, mais très sensible)
- [ ] Phototype de peau (Fitzpatrick I→VI) → influence le rendu et la cicatrisation
- [ ] Dernier don du sang / prochain prévu
- [ ] Date de mise à jour du questionnaire + **re-validation obligatoire si > 12 mois**

### 1.3 Vue 360°
- [ ] Timeline unifiée : tous les mails, RDV, devis, factures, paiements, photos, notes
- [ ] Solde client (reste à payer tous projets confondus)
- [ ] Total dépensé à vie (LTV) + nombre de séances
- [ ] Prochain RDV en évidence

### 1.4 Outils
- [ ] Recherche instantanée (nom, tel, mail, @insta)
- [ ] Détection + **fusion de doublons**
- [ ] Import / export CSV
- [ ] Export complet d'une fiche (droit d'accès RGPD) en 1 clic

---

## 2. Projets de tatouage

> Un client peut avoir **plusieurs projets**, un projet **plusieurs séances**. C'est le cœur du modèle de données.

- [ ] Titre + description du projet
- [ ] **Body map interactif** : cliquer sur la zone du corps (avant/arrière, H/F) → emplacement enregistré
- [ ] Taille (cm × cm), style (réalisme, old school, blackwork, fine line, japonais, lettrage, ornemental…)
- [ ] Couleur / noir & gris / dotwork
- [ ] Type : première fois, ajout, **cover-up**, retouche, reprise d'un autre tatoueur, cicatrice à couvrir
- [ ] Détatouage laser préalable requis ? (nb de séances, praticien)
- [ ] Images de référence envoyées par le client (galerie, upload multiple, drag & drop)
- [ ] **Maquettes du tatoueur** : versions successives (v1, v2…), commentaires client, validation horodatée
- [ ] Stencil / calque final
- [ ] Statut du projet : `idée` → `devis envoyé` → `devis accepté` → `acompte payé` → `en cours` → `terminé` → `en cicatrisation` → `retouche prévue` → `clôturé` / `abandonné`
- [ ] Nombre de séances estimé vs réalisé
- [ ] Prix estimé / prix final / écart
- [ ] Temps estimé vs temps réel passé
- [ ] Photos **avant / pendant / après / cicatrisé** avec dates
- [ ] Consentement droit à l'image lié au projet (✅/❌ publication réseaux)
- [ ] Note de difficulté / satisfaction interne (pour les stats)

---

## 3. Agenda & rendez-vous

### 3.1 Base
- [ ] Vues jour / semaine / mois / liste
- [ ] Types de RDV : **consultation**, séance, retouche (gratuite ?), détourage, essai de stencil
- [ ] Durée + **temps tampon** avant (prépa) et après (nettoyage/désinfection) configurable
- [ ] Horaires d'ouverture, jours de fermeture, congés, jours fériés
- [ ] Multi-tatoueur / multi-poste (cabines) avec code couleur
- [ ] Glisser-déposer pour déplacer un RDV
- [ ] Vue "aujourd'hui" simplifiée sur mobile (le planning du jour en 1 écran)

### 3.2 Automatisations
- [ ] **Rappels automatiques** J-7, J-2, J-1 et H-2 (e-mail + SMS optionnel)
- [ ] **Lien de confirmation en 1 clic** pour le client ("Je confirme" / "Je dois reporter")
- [ ] Un RDV n'est **verrouillé qu'une fois l'acompte encaissé** (sinon reste "provisoire" X heures)
- [ ] Gestion des **no-show** : compteur par client, acompte conservé, mail type
- [ ] Annulation / report : règles configurables (ex. gratuit si > 72 h, acompte perdu sinon)
- [ ] **Liste d'attente** : si un créneau se libère, proposition auto par mail aux inscrits (premier arrivé, premier servi)
- [ ] Blocage des créneaux perso (déjeuner, sport, admin)

### 3.3 Intégrations
- [ ] Flux **iCal / .ics** en lecture seule → s'abonner depuis l'agenda du téléphone
- [ ] Synchro bidirectionnelle Google Calendar (optionnel, phase 2)
- [ ] Prise de RDV en ligne par le client depuis le site public — **avec validation manuelle obligatoire** (jamais de confirmation auto)

---

## 4. Devis

- [ ] Numérotation automatique `DEV-2026-0001`
- [ ] Lignes : désignation, quantité, prix unitaire, remise (%/€)
- [ ] Gestion TVA **ou** mention franchise en base (voir §5.1)
- [ ] Durée de validité (ex. 30 jours) + expiration automatique
- [ ] Conditions : montant de l'acompte, politique d'annulation, nb de séances prévues
- [ ] Génération **PDF** à l'identité du salon (logo, couleurs)
- [ ] Envoi par mail + lien web de consultation (sans compte)
- [ ] **Acceptation en ligne** : signature dessinée au doigt, horodatage, adresse IP, sauvegarde du PDF signé
- [ ] **Relance automatique** si pas de réponse à J+5 et J+12
- [ ] Conversion **devis → facture** (et → RDV) en un clic
- [ ] Duplication d'un devis existant / bibliothèque de prestations pré-remplies
- [ ] Simulateur de prix interne : taille × zone × style × couleur × temps → suggestion de tarif

---

## 5. Factures, acomptes & paiements

### 5.1 Facturation suisse 🇨🇭
- [ ] **Tout en CHF**, format `CHF 1'250.00`
- [ ] **Numérotation séquentielle continue et sans trou**
- [ ] Mentions sur la facture : raison sociale + adresse du salon, **n° IDE/UID** (`CHE-123.456.789`, suivi de `TVA` si assujetti), nom + adresse du client, date d'émission, date de la prestation, désignation détaillée, montant, conditions de règlement, délai de paiement (usuellement 30 jours)
- [ ] **Mode TVA paramétrable** :
  - *Non assujetti* (CA < CHF 100'000) → aucune ligne TVA, aucun taux affiché
  - *Assujetti* → taux **8.1 %**, montant de TVA détaillé, n° IDE avec suffixe TVA, méthode effective **ou** taux de la dette fiscale nette (TDFN)
- [ ] **Alerte de franchissement du seuil** : quand le CA glissant sur 12 mois approche CHF 100'000 → notification "il faut t'annoncer à l'AFC"
- [ ] **QR-facture (Swiss QR-bill)** générée automatiquement sur le PDF : section de paiement avec swiss cross, IBAN ou QR-IBAN, référence QRR/SCOR ou sans référence, montant, débiteur. C'est **le** standard de paiement suisse depuis 2022.
  → librairie `swissqrbill` (npm), conforme aux specs SIX
- [ ] **Facture d'acompte** puis **facture de solde** (acompte déduit)
- [ ] **Note de crédit** en cas de remboursement / annulation
- [ ] Une facture émise ne se modifie plus → note de crédit + nouvelle facture
- [ ] PDF archivé, immuable, **conservé 10 ans** (art. 958f CO)
- [ ] Modèle personnalisable (logo, couleurs, mentions, pied de page)
- [ ] Facture multilingue FR / DE / EN selon la langue du client
- [ ] Rappels de paiement échelonnés : rappel 1 (courtois) → rappel 2 → **mise en demeure** (formulations suisses, mention des frais de rappel si prévus dans les CG)

> ⚠️ **À faire confirmer par sa fiduciaire avant de figer le module** :
> - est-il **assujetti à la TVA** aujourd'hui, et sous quelle méthode (effective ou TDFN) ?
> - son **n° IDE** et son IBAN / QR-IBAN pour la QR-facture
> - **comptabilité simplifiée** (recettes / dépenses / patrimoine, autorisée sous CHF 500'000 de CA, art. 957 CO) ou comptabilité complète ?
> Ces points conditionnent la facturation — ne rien figer avant réponse.

### 5.2 Encaissements 🇨🇭
- [ ] Modes suisses : **TWINT** (prioritaire), espèces, carte (TPE), virement bancaire, QR-facture, PostFinance
- [ ] **Arrondi à 0.05 CHF** sur les paiements en espèces (affiché clairement : total CHF 187.30 → 187.30 par TWINT / 187.30 arrondi à 187.30 en espèces)
- [ ] **Lien de paiement en ligne** acceptant TWINT : Stripe (supporte TWINT en Suisse), **Payrexx** (suisse, TWINT natif) ou Datatrans
- [ ] **QR-facture** dans le mail de devis pour l'acompte + QR code TWINT affichable à l'écran au salon
- [ ] Paiement partiel / échéancier (grosses pièces payées en plusieurs fois)
- [ ] Statuts : brouillon / envoyée / partiellement payée / **payée** / en retard / annulée
- [ ] Rapprochement : un paiement encaissé se rattache à la facture
- [ ] **Relances d'impayés** automatiques (J+7, J+15, J+30) avec escalade du ton
- [ ] Tableau de bord "argent qui rentre" : encaissé ce mois, en attente, en retard

### 5.3 Autres flux d'argent
- [ ] **Chèques cadeaux** : vente, code unique, montant, validité, suivi d'utilisation, rattachement au bénéficiaire
- [ ] Vente de produits (crème cicatrisante, t-shirts, flashs imprimés) avec stock
- [ ] Pourboires (tracés séparément)

---

## 6. Messagerie intégrée 📬 (le gros morceau)

### 6.1 Fonctionnel
- [ ] Boîte de réception dans l'app (onglet dédié) : reçus + envoyés + brouillons + archivés
- [ ] **Vue conversation (thread)** comme Gmail
- [ ] **Rattachement automatique à la fiche client** par adresse e-mail
- [ ] Un e-mail d'un inconnu → bouton "Créer une fiche client" pré-remplie
- [ ] Statuts métier : `en attente de réponse client` / `à traiter` / `répondu` / `clos`
- [ ] **Détection de réponse** : dès que le client répond, le projet/devis passe en "répondu" + notification
- [ ] Relance automatique si aucune réponse après X jours (paramétrable par type de mail)
- [ ] Pièces jointes : devis/factures PDF attachés automatiquement
- [ ] Signature e-mail (HTML, avec logo + liens réseaux)
- [ ] Envoi programmé ("envoyer demain 9 h")
- [ ] Recherche plein texte dans tous les mails
- [ ] Alias multiples : `contact@`, `rdv@`, `facturation@` → tous dans la même boîte
- [ ] Notifications (push navigateur / mail récap quotidien)

### 6.2 Technique ⚠️ le piège classique
- **Ne PAS envoyer les mails directement depuis le VPS** : les IP de VPS sont massivement blacklistées, les mails finiront en spam.
- Envoi → **relais SMTP transactionnel** : **Infomaniak** (suisse, données en Suisse — le choix cohérent ici), Postmark, Brevo, Resend. Quotas gratuits souvent suffisants.
- Réception → **IMAP** sur une boîte hébergée chez l'hébergeur mail que l'app lit en continu.
- 🇨🇭 **Recommandation : Infomaniak** — entreprise suisse, domaine `.ch` + boîtes mail + VPS + SMTP chez un seul prestataire, données hébergées en Suisse, conforme nLPD. Ça simplifie le DNS et évite le morcellement.
- [ ] Configuration DNS : **SPF, DKIM, DMARC**, enregistrements MX, rDNS → sinon délivrabilité catastrophique
- [ ] Gestion des **bounces** (adresse invalide) et des plaintes spam via webhooks → marquer la fiche client
- [ ] Lien de désinscription sur les mails non transactionnels (obligatoire pour les mails "marketing")
- [ ] Assainissement du HTML entrant (anti-XSS) + blocage des images distantes par défaut (pixels de tracking)
- [ ] Limite d'envoi / file d'attente avec retry

### 6.3 Modèles de mails + rédaction assistée
- [ ] Bibliothèque de modèles avec **variables** `{{prenom}}`, `{{date_rdv}}`, `{{montant}}`, `{{lien_paiement}}`…
- [ ] Modèles à prévoir :
  - accusé de réception d'une demande de projet
  - refus poli d'un projet (pas mon style / pas dispo)
  - envoi de devis
  - relance de devis sans réponse
  - confirmation de RDV + adresse + consignes (bien manger, pas d'alcool, vêtements adaptés)
  - rappel J-2 / J-1
  - **fiche d'aftercare** post-séance
  - suivi J+7, J+30
  - demande de photo cicatrisée
  - demande d'**avis Google**
  - relance d'impayé (3 niveaux)
  - proposition de créneau libéré
  - anniversaire / offre fidélité
  - "ça fait longtemps, on finit ton projet ?"
  - annulation / report par le salon
- [ ] **Rédaction automatique assistée par IA** : l'app connaît le client, le projet, l'historique → génère un brouillon contextualisé
- [ ] Toujours **prévisualisation + édition libre** avant le bouton **Envoyer** (jamais d'envoi silencieux)
- [ ] Ton paramétrable (tutoiement/vouvoiement, décontracté/pro) pour coller à la personnalité du tatoueur
- [ ] Suggestion de réponse automatique aux mails entrants

---

## 7. Formulaires, décharges & consentements

- [ ] **Fiche d'information préalable** (risques, contre-indications, déroulé) remise avant la séance
- [ ] **Décharge / consentement éclairé** signée le jour J
- [ ] **Questionnaire médical** (§1.2) à re-valider à chaque séance
- [ ] **Autorisation parentale** pour les mineurs + identité du représentant légal
- [ ] **Cession de droit à l'image** : publication Instagram / site / book, révocable
- [ ] Consentement RGPD : finalités, durée de conservation, droits
- [ ] Signature au doigt sur **tablette au salon** ou **à distance** avant le RDV
- [ ] **QR code à l'accueil** → le client remplit tout sur son propre téléphone
- [ ] PDF généré, horodaté, archivé, attaché au projet ET à la séance
- [ ] Alerte si une séance démarre sans décharge signée

---

## 8. Suivi de cicatrisation (aftercare)

- [ ] Fiche de soins envoyée automatiquement à la fin de la séance
- [ ] Séquence de rappels : J+1, J+3, J+7, J+14, J+30
- [ ] Demande de photo cicatrisée (upload via lien, sans compte)
- [ ] Le client signale un problème → alerte au tatoueur
- [ ] Proposition automatique de **RDV retouche** à J+30 si nécessaire
- [ ] Politique de garantie retouche (gratuite sous X mois, conditions)
- [ ] Demande d'avis Google / post Instagram une fois cicatrisé

---

## 9. Stock, matériel & hygiène ⚠️ souvent oublié

- [ ] **Encres** : marque, référence, couleur, **n° de lot**, date de péremption, date d'ouverture
- [ ] **Traçabilité lot ↔ tatouage** : quel lot d'encre sur quel client — indispensable en cas de rappel sanitaire ou de réaction allergique
- [ ] Cartouches / aiguilles (diamètre, config), gants, films, savons, rasoirs, encre de stencil
- [ ] Seuils d'alerte de réapprovisionnement
- [ ] Fournisseurs, bons de commande, prix d'achat
- [ ] **Coût matière par séance** → calcul de la marge réelle
- [ ] Registre de stérilisation / autoclave : cycles, dates, contrôles, tests d'efficacité
- [ ] Registre de nettoyage / désinfection du poste
- [ ] 🇨🇭 Échéances à suivre avec **rappels automatiques** : contrôle du **chimiste cantonal** / service de la santé publique, annonce d'activité au canton, assurance RC professionnelle, formation premiers secours / hygiène, patente cantonale si exigée
- [ ] 🇨🇭 **Conformité des encres** : vérifier que les encres utilisées respectent la réglementation suisse sur les objets destinés à entrer en contact avec le corps humain (déclaration de conformité du fournisseur à archiver dans l'app)
- [ ] Suivi des **déchets médicaux / objets piquants-tranchants** : bacs à aiguilles, filière d'élimination, attestations

---

## 10. Comptabilité & statistiques

### 10.1 Chiffres
- [ ] CA jour / semaine / mois / trimestre / année + comparaison N-1
- [ ] Encaissé vs facturé vs en attente
- [ ] Panier moyen, prix moyen à l'heure **réel**
- [ ] Taux de conversion : demande → devis → devis accepté → client
- [ ] Taux de no-show et d'annulation
- [ ] Nombre d'heures tatouées / heures travaillées (admin inclus)
- [ ] Top styles, top emplacements, top sources d'acquisition
- [ ] Clients récurrents vs nouveaux
- [ ] Saisonnalité (les creux de janvier, les pics d'été)

### 10.2 Gestion
- [ ] Saisie des **charges** : loyer, matériel, logiciels, assurance, formation, déplacements
- [ ] Résultat = CA − charges
- [ ] 🇨🇭 **Provisions automatiques** : % du CA mis de côté pour **AVS/AI/APG** (cotisations d'indépendant), impôts cantonaux + communaux + fédéral, LPP/3e pilier éventuel — avec compteur "argent qui n'est pas à toi"
- [ ] 🇨🇭 **Comptabilité simplifiée** (recettes / dépenses / état du patrimoine — art. 957 CO, autorisée sous CHF 500'000 de CA) : journal des recettes et dépenses exportable
- [ ] 🇨🇭 Si assujetti TVA : préparation du **décompte TVA trimestriel** (AFC) — CA imposable, TVA due, impôt préalable déductible
- [ ] 🇨🇭 Compteur du **CA glissant sur 12 mois** vs seuil CHF 100'000
- [ ] Export comptable CSV / Excel pour la fiduciaire
- [ ] Objectifs mensuels + jauge de progression
- [ ] Rapport mensuel envoyé par mail automatiquement

---

## 11. Portfolio & flashs

- [ ] Galerie des réalisations (photos cicatrisées, filtrées par consentement image ✅)
- [ ] Tags : style, zone, couleur, taille
- [ ] **Flashs à vendre** : dessin, prix, taille, unique ou répétable, statut `disponible / réservé / tatoué`
- [ ] Réservation d'un flash par un client depuis le site → crée un prospect + projet
- [ ] Watermark automatique sur les images publiées
- [ ] Publication sélective vers le site public
- [ ] Export d'un book PDF pour les conventions

---

## 12. Site public / vitrine

- [ ] Accueil, portfolio, à propos, tarifs indicatifs, FAQ
- [ ] Page **aftercare** publique (le client la retrouve toujours)
- [ ] ⭐ **PRIORITÉ N°1 — Formulaire de demande de projet** structuré : idée, zone, taille, couleur, budget en CHF, disponibilités, références à uploader, majeur ✅, contre-indications
  → alimente directement le CRM.
  **Aujourd'hui il gère tout par DM Instagram.** C'est le point de douleur principal : les demandes se perdent, il n'y a pas d'historique, pas de tri, pas de relance possible. Ce formulaire est le plus gros gain de temps du projet — à mettre dans le **lien en bio Instagram** dès le premier jour. À remonter en Lot 1 malgré son classement initial en Lot 3.
- [ ] Réponse type Instagram à copier-coller : « Envoie-moi ta demande ici 👉 [lien] , je te réponds sous 48 h »
- [ ] Vente de chèques cadeaux en ligne (en CHF)
- [ ] Mentions légales, **CG suisses**, politique de confidentialité conforme **nLPD**, bandeau cookies
- [ ] Site en **FR**, avec DE/EN si la clientèle le justifie
- [ ] SEO local (Google Business Profile, schema.org `TattooParlor`), plan, horaires, search.ch / local.ch
- [ ] Anti-spam sur le formulaire (honeypot + rate limit, éviter le captcha)

---

## 13. Multi-utilisateurs (si le salon accueille d'autres tatoueurs)

- [ ] Rôles : **propriétaire**, tatoueur, apprenti, perceur, manager/accueil, comptable (lecture seule)
- [ ] Chaque tatoueur voit son agenda et ses clients ; le patron voit tout
- [ ] **Loyer de poste ou commission** : calcul automatique de la part salon / part tatoueur, relevé mensuel
- [ ] Gestion des **guest spots** (tatoueur invité sur une période) et des conventions
- [ ] Journal d'activité (qui a modifié quoi, quand)
- [ ] Permissions fines (ex. l'apprenti ne voit pas le CA)

---

## 14. Confort d'usage (ce qui fait qu'il l'utilisera vraiment)

- [ ] **PWA installable** sur le téléphone, avec icône — ça ressemble à une vraie app
- [ ] Mode hors-ligne pour la consultation (l'agenda du jour reste lisible sans réseau)
- [ ] **Dark mode** (et par défaut — ambiance salon)
- [ ] Recherche globale `Ctrl/Cmd + K`
- [ ] Tableau de bord d'accueil : RDV du jour, à faire, mails non lus, argent en attente
- [ ] **Timer de séance** : démarrer/arrêter → temps réel enregistré, facturation horaire juste
- [ ] Raccourcis : "nouveau client + projet + devis" en un seul flux
- [ ] Notifications internes (cloche) + récap quotidien
- [ ] Multi-langue FR/EN si clientèle étrangère
- [ ] Corbeille + historique de modifications (annuler une bêtise)

---

## 15. Architecture technique

### 15.1 Stack proposée
| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | front + API dans un seul projet, un seul déploiement |
| UI | Tailwind CSS + shadcn/ui | rapide, propre, dark mode natif |
| Base de données | **PostgreSQL 16** | relationnel, robuste, parfait pour ce modèle |
| ORM | Prisma ou Drizzle | migrations versionnées |
| Auth | Auth.js / Lucia, sessions + **2FA** | |
| Fichiers | stockage disque VPS + sauvegarde S3 (ou MinIO) | photos volumineuses |
| Mails sortants | relais SMTP transactionnel (Brevo / Scaleway TEM…) | délivrabilité |
| Mails entrants | IMAP (ImapFlow) + worker de synchro | |
| PDF | React-PDF ou Puppeteer | devis/factures |
| **QR-facture** 🇨🇭 | **`swissqrbill`** (npm) | Swiss QR-bill conforme SIX, intégrée au PDF |
| Montants | **Décimal exact en base** (jamais de `float`), stockage en **centimes (integer)** | arrondi 0.05 CHF, aucune erreur de calcul |
| Formatage | `Intl.NumberFormat('fr-CH', {currency:'CHF'})` | `CHF 1'250.00` automatiquement |
| Tâches planifiées | BullMQ + Redis, ou cron | rappels, relances, synchro mail |
| Paiement | **Stripe** (TWINT + carte) ou **Payrexx** 🇨🇭 | TWINT indispensable en Suisse |
| i18n | next-intl | FR par défaut, DE/EN extensibles |
| Déploiement | **Docker Compose + Caddy** (HTTPS auto) sur le VPS | |
| CI/CD | GitHub Actions → build + déploiement auto | |
| Monitoring | Sentry (erreurs) + Uptime Kuma | |

### 15.2 Exploitation
- [ ] `docker-compose.yml` : app + Postgres + Redis + Caddy
- [ ] Variables d'environnement (`.env`) — **jamais commitées**
- [ ] Migrations de base automatiques au déploiement
- [ ] **Sauvegardes quotidiennes chiffrées** de la base + des fichiers, envoyées hors du VPS, **restauration testée** (une sauvegarde jamais restaurée n'est pas une sauvegarde)
- [ ] Environnement de préproduction (sous-domaine `staging.`) avant chaque mise en ligne
- [ ] Rate limiting, protection brute-force, en-têtes de sécurité, CSP
- [ ] Logs d'accès aux données sensibles
- [ ] Healthcheck + redémarrage auto

---

## 16. Protection des données 🇨🇭 nLPD ⚠️ à traiter sérieusement

La Suisse n'applique **pas** le RGPD mais la **nLPD / revDSG** (nouvelle loi fédérale sur la protection des données, en vigueur depuis le 1er septembre 2023). Elle est très proche du RGPD dans l'esprit, avec des différences de vocabulaire et de procédure.

> Le **RGPD s'applique en plus** si le salon a des clients résidant dans l'UE (frontaliers français, touristes européens) — ce qui est quasi certain en Suisse romande. **On construit donc au niveau d'exigence le plus élevé des deux**, ça évite de choisir.

Le questionnaire médical = **données sensibles** au sens de l'art. 5 nLPD. Les photos de tatouages sur le corps = données personnelles identifiantes.

- [ ] **Registre des activités de traitement** (obligatoire au-delà de 250 employés, mais recommandé quoi qu'il arrive — et exigé par le RGPD pour les données sensibles)
- [ ] **Consentement explicite et séparé** pour : données de santé, droit à l'image, mails marketing
- [ ] **Durées de conservation** définies (données médicales : X ans après la dernière séance ; **factures : 10 ans, art. 958f CO**) + **purge automatique**
- [ ] Droits de la personne concernée : accès, rectification, effacement, **remise/portabilité des données** (art. 28 nLPD) → **boutons dans l'app**, pas un processus manuel
- [ ] **Chiffrement au repos** des champs médicaux + du stockage des photos
- [ ] Journalisation des accès aux données sensibles
- [ ] **Privacy by design / by default** (art. 7 nLPD) — inscrit explicitement dans la loi
- [ ] Déclaration de confidentialité + mentions légales rédigées (obligation d'information renforcée, art. 19 nLPD)
- [ ] Contrats de sous-traitance avec les prestataires (hébergeur, Stripe/Payrexx, relais mail)
- [ ] **Hébergement en Suisse** de préférence (Infomaniak, Exoscale) — sinon UE. Éviter les prestataires hors Suisse/UE sans garanties.
- [ ] Ne **pas** stocker les copies de pièces d'identité (garder seulement « identité vérifiée le… »)
- [ ] Procédure en cas de violation : **annonce au PFPDT** « dans les meilleurs délais » (nLPD) + **72 h à l'autorité UE** si des résidents UE sont concernés
- [ ] 🇨🇭 **Analyse d'impact (AIPD)** recommandée : données de santé + traitement systématique

**À faire valider par sa fiduciaire / un juriste** : assujettissement TVA et méthode, n° IDE, régime comptable, obligations cantonales de la profession (annonce d'activité, contrôle du chimiste cantonal, assurance RC pro), conditions générales et politique d'annulation.

---

## 17. Découpage en lots

> Périmètre confirmé : **un seul tatoueur**, pas de multi-utilisateur. On garde malgré tout un champ `artist_id` sur les enregistrements — ça ne coûte rien aujourd'hui et évite une migration douloureuse s'il embauche un jour.
> Aucune donnée existante à reprendre (tout est dans les DM Instagram) → **pas de module d'import**, on démarre propre.

### 🥇 Lot 1 — MVP (le minimum pour sortir des DM Instagram)
1. Auth + compte tatoueur + 2FA
2. Clients (fiche complète + questionnaire médical + recherche)
3. Projets + photos + références
4. Agenda & RDV manuels + rappels
5. ⭐ **Formulaire public de demande de projet** → lien en bio Instagram *(remonté depuis le Lot 3 : c'est son problème n°1)*
6. Devis PDF en CHF + envoi par mail
7. Factures PDF en CHF + **QR-facture** + suivi des paiements
8. Envoi d'e-mails avec modèles + rédaction assistée + bouton **Envoyer**
9. Tableau de bord basique

### 🥈 Lot 2 — La messagerie complète
10. Réception IMAP + boîte de réception + threads
11. Rattachement auto aux clients + détection de réponse
12. Rappels & relances automatiques
13. Décharges / consentements avec signature
14. Aftercare automatisé

### 🥉 Lot 3 — Le confort
15. Site vitrine complet (portfolio, tarifs, FAQ, aftercare public)
16. Paiement en ligne TWINT/carte + acomptes
17. Statistiques & compta (provisions AVS, seuil TVA)
18. Stock & traçabilité des encres
19. Portfolio / flashs / chèques cadeaux

### 🏅 Lot 4 — L'extension
20. Prise de RDV en ligne
21. SMS, synchro Google Calendar
22. PWA hors-ligne, body map avancé
23. DE/EN si la clientèle le demande
24. *(si un jour)* Multi-tatoueurs, commissions, guest spots

---

## 18. Décisions

### ✅ Tranché
| Question | Réponse |
|---|---|
| Pays / devise | **Suisse, tout en CHF**, TVA suisse |
| Nombre de tatoueurs | **Un seul** — mono-utilisateur |
| Domaine & mails | **Rien d'acheté** → à mettre en place (recommandation : Infomaniak, `.ch`) |
| Outils actuels | **Instagram DM uniquement** → aucune donnée à importer, formulaire public prioritaire |

### ❓ À trancher avant de coder la facturation
| # | Question | Impact |
|---|---|---|
| 1 | **Assujetti à la TVA ou non ?** (seuil CHF 100'000) | Si non → aucune TVA sur les factures. Bloquant pour le Lot 1. |
| 2 | Si assujetti : méthode **effective** ou **TDFN** ? | Calcul et décompte AFC |
| 3 | **N° IDE** (CHE-xxx.xxx.xxx) et **IBAN / QR-IBAN** | Obligatoires pour la QR-facture |
| 4 | Raison sociale exacte + adresse du salon + canton | Mentions de facture, obligations cantonales |
| 5 | Entreprise individuelle ou Sàrl ? | Mentions légales, comptabilité |

### ❓ À trancher avant le déploiement
| # | Question | Impact |
|---|---|---|
| 6 | Specs du VPS (RAM, CPU, disque, OS) — déjà loué ou à prendre ? | Faisabilité Docker + Postgres. **4 Go de RAM minimum.** |
| 7 | Nom de domaine souhaité (`.ch`) | Achat + config DNS |
| 8 | Paiement en ligne **TWINT** voulu ? Stripe ou Payrexx ? | Intégration + frais |
| 9 | Encaisse-t-il déjà par carte ? Quel TPE ? | Rapprochement des encaissements |
| 10 | SMS souhaités ? (~0.05 CHF/SMS) | Budget récurrent |
| 11 | Clientèle : FR seul, ou aussi DE/EN ? | i18n dès le départ ou plus tard |
| 12 | Qui administre l'app au quotidien — toi ou lui ? | Niveau de doc et d'auto-réparation nécessaire |
| 13 | Logo / identité visuelle existants ? | Design des PDF et de l'app |

---

## 19. Budget récurrent estimé

| Poste | Coût mensuel indicatif (CHF) |
|---|---|
| VPS 4 Go RAM (Infomaniak / Exoscale / Hetzner) | 10–25 |
| Nom de domaine `.ch` | ~1 |
| Boîtes mail pro | 0–8 |
| Relais SMTP transactionnel | 0 (offre gratuite) → 15 |
| Stripe / Payrexx (TWINT + carte) | ~1.5–2.9 % par transaction |
| Sauvegarde hors-site | 2–8 |
| SMS (option) | à l'usage (~0.05/SMS) |
| **Total fixe** | **~15–55 CHF/mois** |

> Un hébergement 100 % suisse coûte un peu plus cher qu'en UE, mais c'est cohérent avec la nLPD et rassurant pour les clients sur des données de santé. À arbitrer.

---

## 20. Points de vigilance

1. **Délivrabilité des mails** — le sujet n°1 qui peut ruiner le projet. SPF/DKIM/DMARC dès le départ, relais transactionnel, jamais d'envoi direct depuis le VPS.
2. **Ne jamais envoyer un mail sans validation humaine** au début. La confiance se construit ; un mail automatique gênant envoyé à un client, et l'outil est abandonné.
3. **Sauvegardes testées.** Perdre l'agenda et la compta d'un salon = catastrophe.
4. **Le mobile d'abord.** S'il ne peut pas tout faire depuis son téléphone entre deux clients, il retournera aux DM Instagram.
5. 🇨🇭 **Ne jamais afficher de TVA tant qu'il n'est pas assujetti.** Facturer une TVA sans être inscrit au registre AFC est une faute. Le mode TVA est un paramètre, vérifié avant la première facture réelle.
6. 🇨🇭 **Montants en centimes entiers en base, jamais en `float`.** Avec l'arrondi à 0.05 CHF, les erreurs de virgule flottante deviennent visibles sur les factures.
7. 🇨🇭 **QR-facture testée en conditions réelles** : scanner le PDF avec une vraie app bancaire suisse (PostFinance, UBS, Raiffeisen…) avant la mise en production. Une QR-facture mal formée est rejetée par la banque.
8. **La transition depuis Instagram est le vrai enjeu.** L'app ne sert à rien s'il continue à répondre aux DM. Le formulaire public doit être en ligne et dans sa bio **dès le Lot 1**, avec une réponse type à copier-coller dans les DM pour rediriger les gens.
9. **Cadrer le périmètre.** Tout ce document ne se construit pas d'un coup : Lot 1 en production rapidement, le reste au fil de l'usage réel.
10. **Le former.** Prévoir une courte doc/vidéo et une session de prise en main.
