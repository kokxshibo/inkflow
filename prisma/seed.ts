/**
 * Jeu de données initial.
 *
 * Crée le compte d'accès, les réglages, les modèles d'e-mails,
 * et quelques clients/projets/documents de démonstration pour que
 * l'application ne soit pas vide au premier lancement.
 *
 * Relancer ce script est sans danger : il n'écrase rien d'existant.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_EMAIL_TEMPLATES } from "../src/lib/default-templates.ts";

const db = new PrismaClient();

const EMAIL = "tatoueur@exemple.ch";
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
        ownerName: "Marc Ducrey",
        addressLine: "Rue du Rhône 12",
        postalCode: "1204",
        city: "Genève",
        canton: "GE",
        country: "CH",
        email: "contact@marcink.ch",
        phone: "+41 22 123 45 67",
        instagram: "marc.ink",
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
          "Marc Ducrey\nMarc Ink\nRue du Rhône 12, 1204 Genève\n+41 79 123 45 67",
      },
    });
    console.log("  Réglages créés");
  } else {
    console.log("  Réglages déjà présents");
  }

  /* ─────────────────── Modèles d'e-mails ─────────────────── */

  const templates = DEFAULT_EMAIL_TEMPLATES;


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
