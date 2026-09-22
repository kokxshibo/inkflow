/**
 * Jeu de données initial.
 *
 * Crée le compte d'accès, les réglages du salon, les modèles d'e-mails,
 * et quelques clients/projets/documents de démonstration pour que
 * l'application ne soit pas vide au premier lancement.
 *
 * Relancer ce script est sans danger : il n'écrase rien d'existant.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const EMAIL = "tatoueur@monsalon.ch";
const PASSWORD = "InkFlow2026!";

function daysFromNow(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function randomToken(length = 28) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

async function main() {
  console.log("Initialisation de la base…\n");

  /* ─────────────────────────── Compte ─────────────────────────── */

  const existingUser = await db.user.findUnique({ where: { email: EMAIL } });
  if (!existingUser) {
    await db.user.create({
      data: {
        email: EMAIL,
        name: "Marc Ducrey",
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        role: "owner",
      },
    });
    console.log("  Compte créé");
  } else {
    console.log("  Compte déjà présent");
  }

  /* ────────────────────────── Réglages ────────────────────────── */

  const existingSettings = await db.settings.findUnique({ where: { id: 1 } });
  if (!existingSettings) {
    await db.settings.create({
      data: {
        id: 1,
        studioName: "Encre Noire Tattoo",
        ownerName: "Marc Ducrey",
        addressLine: "Rue du Rhône 12",
        postalCode: "1204",
        city: "Genève",
        canton: "GE",
        country: "CH",
        email: "contact@encrenoire.ch",
        phone: "+41 22 123 45 67",
        instagram: "encrenoire.tattoo",
        ide: "CHE-123.456.789",
        legalForm: "individual",
        // Sous le seuil de CHF 100'000 : non assujetti à la TVA.
        vatEnabled: false,
        vatRate: 8.1,
        // IBAN de test publié par SIX pour la QR-facture.
        iban: "CH9300762011623852957",
        bankName: "PostFinance",
        hourlyRate: 15000,
        minimumPrice: 15000,
        depositPercent: 30,
        paymentTermDays: 30,
        quoteValidityDays: 30,
        emailSignature:
          "Marc\nEncre Noire Tattoo\nRue du Rhône 12, 1204 Genève\n+41 22 123 45 67",
      },
    });
    console.log("  Réglages créés");
  } else {
    console.log("  Réglages déjà présents");
  }

  /* ─────────────────── Modèles d'e-mails ─────────────────── */

  const templates = [
    {
      key: "quote_send",
      name: "Envoi de devis",
      category: "quote",
      subject: "Ton devis {{numero}} — {{salon}}",
      body: `Salut {{prenom}},

Merci pour ta confiance ! Voici le devis pour ton projet, que je joins en PDF à ce message.

Montant total : {{montant}}
Acompte pour bloquer la date : {{acompte}}

Tu peux consulter et accepter le devis directement en ligne ici :
{{lien}}

Dès que l'acompte est versé, je réserve ton créneau. N'hésite pas si tu as la moindre question sur le projet ou le déroulé.

À bientôt,
{{signature}}`,
      isSystem: true,
    },
    {
      key: "quote_reminder",
      name: "Relance de devis",
      category: "quote",
      subject: "Ton devis {{numero}} — tu en penses quoi ?",
      body: `Salut {{prenom}},

Je reviens vers toi au sujet du devis {{numero}} que je t'ai envoyé il y a quelques jours.

Tu peux le retrouver ici : {{lien}}

Aucune pression — dis-moi simplement si le projet te convient, si tu veux ajuster quelque chose, ou si tu préfères laisser tomber. Je préfère une réponse claire, quelle qu'elle soit.

{{signature}}`,
      isSystem: true,
    },
    {
      key: "invoice_send",
      name: "Envoi de facture",
      category: "invoice",
      subject: "Facture {{numero}} — {{salon}}",
      body: `Salut {{prenom}},

Merci pour la séance ! Tu trouveras la facture {{numero}} en pièce jointe.

Montant : {{montant}}
À régler d'ici au {{echeance}}

Le PDF contient une QR-facture : tu peux la scanner directement depuis ton application bancaire, tout se remplit automatiquement. Le paiement par TWINT reste possible aussi, dis-moi si tu préfères.

{{signature}}`,
      isSystem: true,
    },
    {
      key: "invoice_reminder",
      name: "Rappel de paiement",
      category: "invoice",
      subject: "Petit rappel — facture {{numero}}",
      body: `Salut {{prenom}},

Un petit rappel au sujet de la facture {{numero}} d'un montant de {{montant}}, dont l'échéance était fixée au {{echeance}}.

C'est probablement passé à la trappe — ça arrive. Le PDF avec la QR-facture est en pièce jointe pour te simplifier la tâche.

Si un souci se présente, écris-moi, on trouvera une solution.

{{signature}}`,
      isSystem: true,
    },
    {
      key: "appointment_confirm",
      name: "Confirmation de rendez-vous",
      category: "appointment",
      subject: "C'est confirmé — {{date_rdv}} à {{heure_rdv}}",
      body: `Salut {{prenom}},

Ton rendez-vous est confirmé :

Date : {{date_rdv}} à {{heure_rdv}}
Projet : {{projet}}
Adresse : Rue du Rhône 12, 1204 Genève

Pour que la séance se passe au mieux :
- mange correctement avant de venir, et prends de quoi grignoter
- pas d'alcool la veille ni le jour même
- porte des vêtements confortables donnant accès à la zone à tatouer
- dors bien, ça change vraiment tout

Si tu dois annuler ou reporter, préviens-moi au moins 72 heures à l'avance.

À très vite,
{{signature}}`,
      isSystem: true,
    },
    {
      key: "appointment_reminder",
      name: "Rappel de rendez-vous",
      category: "appointment",
      subject: "Rappel — on se voit {{date_rdv}}",
      body: `Salut {{prenom}},

Petit rappel : on se retrouve {{date_rdv}} à {{heure_rdv}} pour {{projet}}.

Pense à bien manger avant et à porter des vêtements adaptés à la zone.

À bientôt,
{{signature}}`,
      isSystem: true,
    },
    {
      key: "aftercare",
      name: "Conseils de cicatrisation",
      category: "aftercare",
      subject: "Les soins pour ton tatouage",
      body: `Salut {{prenom}},

Merci pour cette séance, c'était un plaisir ! Voici les soins à suivre.

Les premières 24 heures
- garde le film 2 à 4 heures, puis retire-le délicatement
- lave à l'eau tiède avec un savon doux au pH neutre, sans frotter
- sèche en tamponnant avec un essuie-tout propre, jamais de serviette

Les deux premières semaines
- applique une fine couche de crème cicatrisante 2 à 3 fois par jour
- ne gratte pas, ne décolle pas les croûtes, même si ça démange
- pas de piscine, pas de bain, pas de sauna, pas de mer
- pas d'exposition au soleil, et ensuite écran total à vie sur la zone
- douche rapide plutôt que bain prolongé

Quand me contacter
Rougeur qui s'étend, gonflement, chaleur, douleur qui augmente après 48 heures ou écoulement inhabituel : écris-moi tout de suite.

Envoie-moi une photo dans un mois, que je voie comment ça a cicatrisé. Si une retouche est nécessaire, elle est offerte.

{{signature}}`,
      isSystem: true,
    },
    {
      key: "review_request",
      name: "Demande d'avis",
      category: "aftercare",
      subject: "Ton tatouage a cicatrisé ?",
      body: `Salut {{prenom}},

Ça fait un mois environ — j'espère que ton tatouage a bien cicatrisé et qu'il te plaît toujours autant.

Deux petites choses si tu as un moment :
- envoie-moi une photo de la zone cicatrisée, ça m'aide vraiment à suivre mon travail
- si l'expérience t'a plu, un avis Google ferait une vraie différence pour le salon

Et si quelque chose ne va pas, dis-le-moi : la retouche est offerte.

Merci,
{{signature}}`,
      isSystem: true,
    },
    {
      key: "request_ack",
      name: "Accusé de réception d'une demande",
      category: "general",
      subject: "J'ai bien reçu ta demande — {{salon}}",
      body: `Salut {{prenom}},

Merci pour ta demande, elle est bien arrivée.

Je regarde tous les projets dans l'ordre d'arrivée et je reviens vers toi dans les prochains jours avec mon avis, mes disponibilités et une estimation de prix.

Si entre-temps tu as d'autres références ou des précisions à ajouter, réponds simplement à ce message.

À bientôt,
{{signature}}`,
      isSystem: true,
    },
    {
      key: "request_decline",
      name: "Refus poli d'un projet",
      category: "general",
      subject: "À propos de ton projet",
      body: `Salut {{prenom}},

Merci d'avoir pensé à moi pour ton projet.

Après réflexion, je préfère ne pas le prendre : ce n'est pas tout à fait dans mon style, et je pense qu'un autre tatoueur te rendra un bien meilleur travail. Je préfère être honnête plutôt que de te livrer quelque chose de moyen.

Si tu veux, je peux t'orienter vers quelqu'un dont c'est vraiment la spécialité — dis-moi.

Bonne continuation pour ton projet,
{{signature}}`,
      isSystem: true,
    },
  ];

  let created = 0;
  for (const template of templates) {
    const existing = await db.emailTemplate.findUnique({
      where: { key: template.key },
    });
    if (!existing) {
      await db.emailTemplate.create({ data: template });
      created++;
    }
  }
  console.log(`  ${created} modèle(s) d'e-mail créé(s)`);

  /* ────────────────── Données de démonstration ────────────────── */

  const clientCount = await db.client.count();
  if (clientCount > 0) {
    console.log("  Données de démonstration déjà présentes\n");
    return;
  }

  const lea = await db.client.create({
    data: {
      firstName: "Léa",
      lastName: "Morand",
      email: "lea.morand@example.ch",
      phone: "+41 79 456 12 34",
      instagram: "lea.morand",
      birthDate: new Date("1996-04-18"),
      addressLine: "Avenue de Champel 24",
      postalCode: "1206",
      city: "Genève",
      country: "CH",
      source: "instagram",
      status: "active",
      skinType: "III",
      allergies: "Allergie au latex — gants nitrile obligatoires",
      imageConsent: true,
      marketingConsent: true,
      identityVerifiedAt: new Date(),
      medicalUpdatedAt: new Date(),
      dataConsentAt: new Date(),
      notes: "Supporte bien les longues séances. Préfère les rendez-vous le matin.",
    },
  });

  const thomas = await db.client.create({
    data: {
      firstName: "Thomas",
      lastName: "Bereuter",
      email: "t.bereuter@example.ch",
      phone: "+41 78 222 88 10",
      birthDate: new Date("1989-11-02"),
      addressLine: "Rue de Carouge 8",
      postalCode: "1205",
      city: "Genève",
      country: "CH",
      language: "de",
      source: "word_of_mouth",
      status: "active",
      keloidProne: true,
      medicalNotes: "Terrain à chéloïdes — surveiller la cicatrisation de près.",
      imageConsent: false,
      medicalUpdatedAt: new Date(),
      dataConsentAt: new Date(),
    },
  });

  await db.client.create({
    data: {
      firstName: "Sofia",
      lastName: "Rey",
      email: "sofia.rey@example.ch",
      instagram: "sofia.rey",
      source: "website",
      status: "prospect",
      dataConsentAt: new Date(),
    },
  });

  const projectLea = await db.project.create({
    data: {
      clientId: lea.id,
      title: "Manchette japonaise — carpe et vagues",
      description:
        "Carpe koï remontant l'avant-bras, vagues en fond, feuilles d'érable. Style japonais traditionnel, noir et gris avec quelques touches de rouge sur les feuilles.",
      bodyZone: "avant_bras_g",
      widthCm: 14,
      heightCm: 28,
      style: "japonais",
      colorMode: "blackgrey",
      kind: "new",
      status: "deposit_paid",
      estimatedSessions: 3,
      estimatedPrice: 180000,
    },
  });

  await db.project.create({
    data: {
      clientId: thomas.id,
      title: "Cover-up tribal — épaule droite",
      description:
        "Recouvrement d'un ancien tribal des années 2000. Blackwork dense, motifs géométriques.",
      bodyZone: "epaule_d",
      widthCm: 18,
      heightCm: 20,
      style: "blackwork",
      colorMode: "blackgrey",
      kind: "coverup",
      status: "quoted",
      estimatedSessions: 2,
      estimatedPrice: 120000,
    },
  });

  await db.appointment.createMany({
    data: [
      {
        clientId: lea.id,
        projectId: projectLea.id,
        title: "Léa Morand",
        type: "session",
        startAt: daysFromNow(2, 10),
        endAt: daysFromNow(2, 14),
        status: "confirmed",
        depositRequired: 54000,
        depositPaid: true,
        notes: "2e séance — ombrage des vagues.",
      },
      {
        clientId: thomas.id,
        title: "Thomas Bereuter",
        type: "consultation",
        startAt: daysFromNow(5, 16),
        endAt: daysFromNow(5, 17),
        status: "confirmed",
        notes: "Voir le tribal existant et discuter du recouvrement.",
      },
      {
        clientId: lea.id,
        projectId: projectLea.id,
        title: "Léa Morand",
        type: "session",
        startAt: daysFromNow(-20, 10),
        endAt: daysFromNow(-20, 15),
        status: "done",
        actualMinutes: 290,
      },
    ],
  });

  const quote = await db.quote.create({
    data: {
      number: "DEV-2026-0001",
      clientId: lea.id,
      projectId: projectLea.id,
      status: "accepted",
      issuedAt: daysFromNow(-40),
      validUntil: daysFromNow(-10),
      acceptedAt: daysFromNow(-35),
      acceptanceName: "Léa Morand",
      subtotal: 180000,
      discount: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 180000,
      depositAmount: 54000,
      publicToken: randomToken(),
      terms:
        "Acompte non remboursable en cas d'annulation à moins de 72 heures du rendez-vous.",
      items: {
        create: [
          {
            label: "Manchette japonaise — 3 séances",
            description: "Carpe koï, vagues et feuilles d'érable, avant-bras gauche",
            quantity: 3,
            unitPrice: 60000,
            position: 0,
          },
        ],
      },
    },
  });

  await db.counter.upsert({
    where: { id: `quote-${new Date().getFullYear()}` },
    create: { id: `quote-${new Date().getFullYear()}`, value: 1 },
    update: { value: 1 },
  });

  const invoice = await db.invoice.create({
    data: {
      number: "FAC-2026-0001",
      clientId: lea.id,
      projectId: projectLea.id,
      quoteId: quote.id,
      kind: "deposit",
      status: "paid",
      issuedAt: daysFromNow(-35),
      dueAt: daysFromNow(-5),
      sentAt: daysFromNow(-35),
      paidAt: daysFromNow(-34),
      subtotal: 54000,
      discount: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 54000,
      amountPaid: 54000,
      publicToken: randomToken(),
      items: {
        create: [
          {
            label: "Acompte sur devis DEV-2026-0001",
            description: "30 % du montant total du projet",
            quantity: 1,
            unitPrice: 54000,
            position: 0,
          },
        ],
      },
    },
  });

  await db.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 54000,
      method: "twint",
      paidAt: daysFromNow(-34),
    },
  });

  await db.counter.upsert({
    where: { id: `invoice-${new Date().getFullYear()}` },
    create: { id: `invoice-${new Date().getFullYear()}`, value: 1 },
    update: { value: 1 },
  });

  await db.projectRequest.create({
    data: {
      firstName: "Noah",
      lastName: "Perrin",
      email: "noah.perrin@example.ch",
      instagram: "noah.prrn",
      description:
        "J'aimerais un lettrage fin sur l'avant-bras, le prénom de ma fille avec une petite constellation autour. Quelque chose de discret et élégant, rien de trop chargé.",
      bodyZone: "avant_bras_d",
      sizeCm: "8 x 3 cm",
      colorMode: "blackgrey",
      style: "fine_line",
      budget: "300 – 600 CHF",
      availability: "Plutôt les samedis ou en fin de journée",
      isAdult: true,
      consentGiven: true,
      status: "new",
      referenceUrls: "[]",
    },
  });

  console.log("  Données de démonstration créées\n");
}

main()
  .then(async () => {
    console.log("Base prête.\n");
    console.log("  Identifiants de connexion");
    console.log(`  E-mail       ${EMAIL}`);
    console.log(`  Mot de passe ${PASSWORD}\n`);
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error("Échec de l'initialisation :", error);
    await db.$disconnect();
    process.exit(1);
  });
