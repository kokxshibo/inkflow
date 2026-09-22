/** Libellés métier centralisés — une seule source de vérité pour toute l'UI. */

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface Option {
  value: string;
  label: string;
  tone?: Tone;
  hint?: string;
}

/* ───────────────────────────── Clients ───────────────────────────── */

export const CLIENT_STATUS: Option[] = [
  { value: "prospect", label: "Prospect", tone: "info" },
  { value: "active", label: "Client actif", tone: "success" },
  { value: "inactive", label: "Inactif", tone: "neutral" },
  { value: "archived", label: "Archivé", tone: "neutral" },
  { value: "blocked", label: "Liste rouge", tone: "danger" },
];

export const CLIENT_SOURCE: Option[] = [
  { value: "instagram", label: "Instagram" },
  { value: "website", label: "Formulaire du site" },
  { value: "word_of_mouth", label: "Bouche-à-oreille" },
  { value: "google", label: "Google" },
  { value: "walk_in", label: "Passage au salon" },
  { value: "referral", label: "Parrainage" },
  { value: "convention", label: "Convention" },
  { value: "other", label: "Autre" },
];

export const LANGUAGES: Option[] = [
  { value: "fr", label: "Français" },
  { value: "de", label: "Allemand" },
  { value: "en", label: "Anglais" },
];

export const SKIN_TYPES: Option[] = [
  { value: "I", label: "I — très claire, brûle toujours" },
  { value: "II", label: "II — claire, brûle facilement" },
  { value: "III", label: "III — intermédiaire" },
  { value: "IV", label: "IV — mate, bronze facilement" },
  { value: "V", label: "V — foncée" },
  { value: "VI", label: "VI — très foncée" },
];

export const MEDICAL_CONDITIONS: Option[] = [
  { value: "diabetes", label: "Diabète" },
  { value: "epilepsy", label: "Épilepsie" },
  { value: "hemophilia", label: "Trouble de la coagulation" },
  { value: "heart", label: "Problème cardiaque" },
  { value: "immuno", label: "Immunodépression" },
  { value: "skin", label: "Affection cutanée (psoriasis, eczéma…)" },
  { value: "anticoagulant", label: "Traitement anticoagulant" },
  { value: "isotretinoin", label: "Isotrétinoïne (Roaccutane)" },
];

/* ───────────────────────────── Projets ───────────────────────────── */

export const PROJECT_STATUS: Option[] = [
  { value: "idea", label: "Idée", tone: "neutral" },
  { value: "quoted", label: "Devis envoyé", tone: "info" },
  { value: "accepted", label: "Devis accepté", tone: "info" },
  { value: "deposit_paid", label: "Acompte payé", tone: "accent" },
  { value: "in_progress", label: "En cours", tone: "accent" },
  { value: "healing", label: "En cicatrisation", tone: "warning" },
  { value: "touchup", label: "Retouche prévue", tone: "warning" },
  { value: "done", label: "Terminé", tone: "success" },
  { value: "cancelled", label: "Abandonné", tone: "danger" },
];

export const PROJECT_KIND: Option[] = [
  { value: "new", label: "Nouveau tatouage" },
  { value: "addition", label: "Ajout / extension" },
  { value: "coverup", label: "Cover-up" },
  { value: "touchup", label: "Retouche" },
  { value: "rework", label: "Reprise d'un autre tatoueur" },
];

export const PROJECT_STYLE: Option[] = [
  { value: "realisme", label: "Réalisme" },
  { value: "old_school", label: "Old school" },
  { value: "neo_trad", label: "Néo-traditionnel" },
  { value: "blackwork", label: "Blackwork" },
  { value: "fine_line", label: "Fine line" },
  { value: "japonais", label: "Japonais" },
  { value: "lettrage", label: "Lettrage" },
  { value: "ornemental", label: "Ornemental" },
  { value: "geometrique", label: "Géométrique" },
  { value: "aquarelle", label: "Aquarelle" },
  { value: "tribal", label: "Tribal" },
  { value: "autre", label: "Autre" },
];

export const COLOR_MODE: Option[] = [
  { value: "blackgrey", label: "Noir & gris" },
  { value: "color", label: "Couleur" },
  { value: "dotwork", label: "Dotwork" },
];

export const BODY_ZONES: Option[] = [
  { value: "avant_bras_g", label: "Avant-bras gauche" },
  { value: "avant_bras_d", label: "Avant-bras droit" },
  { value: "bras_g", label: "Bras gauche" },
  { value: "bras_d", label: "Bras droit" },
  { value: "epaule_g", label: "Épaule gauche" },
  { value: "epaule_d", label: "Épaule droite" },
  { value: "pectoral", label: "Pectoraux" },
  { value: "ventre", label: "Ventre" },
  { value: "cotes_g", label: "Côtes gauches" },
  { value: "cotes_d", label: "Côtes droites" },
  { value: "dos_haut", label: "Haut du dos" },
  { value: "dos_bas", label: "Bas du dos" },
  { value: "dos_complet", label: "Dos complet" },
  { value: "cuisse_g", label: "Cuisse gauche" },
  { value: "cuisse_d", label: "Cuisse droite" },
  { value: "mollet_g", label: "Mollet gauche" },
  { value: "mollet_d", label: "Mollet droit" },
  { value: "cheville_g", label: "Cheville gauche" },
  { value: "cheville_d", label: "Cheville droite" },
  { value: "main_g", label: "Main gauche" },
  { value: "main_d", label: "Main droite" },
  { value: "cou", label: "Cou" },
  { value: "autre", label: "Autre" },
];

export const IMAGE_KIND: Option[] = [
  { value: "reference", label: "Référence client" },
  { value: "design", label: "Maquette" },
  { value: "stencil", label: "Stencil" },
  { value: "before", label: "Avant" },
  { value: "during", label: "Pendant" },
  { value: "after", label: "Après séance" },
  { value: "healed", label: "Cicatrisé" },
];

/* ──────────────────────────── Rendez-vous ─────────────────────────── */

export const APPOINTMENT_TYPE: Option[] = [
  { value: "consultation", label: "Consultation", tone: "info" },
  { value: "session", label: "Séance", tone: "accent" },
  { value: "touchup", label: "Retouche", tone: "warning" },
  { value: "stencil", label: "Essai de stencil", tone: "neutral" },
  { value: "blocked", label: "Indisponible", tone: "neutral" },
  { value: "other", label: "Autre", tone: "neutral" },
];

export const APPOINTMENT_STATUS: Option[] = [
  { value: "draft", label: "Provisoire", tone: "warning", hint: "En attente d'acompte" },
  { value: "confirmed", label: "Confirmé", tone: "success" },
  { value: "done", label: "Effectué", tone: "neutral" },
  { value: "cancelled", label: "Annulé", tone: "neutral" },
  { value: "no_show", label: "Non présenté", tone: "danger" },
];

/* ───────────────────────── Devis & factures ──────────────────────── */

export const QUOTE_STATUS: Option[] = [
  { value: "draft", label: "Brouillon", tone: "neutral" },
  { value: "sent", label: "Envoyé", tone: "info" },
  { value: "accepted", label: "Accepté", tone: "success" },
  { value: "refused", label: "Refusé", tone: "danger" },
  { value: "expired", label: "Expiré", tone: "warning" },
];

export const INVOICE_STATUS: Option[] = [
  { value: "draft", label: "Brouillon", tone: "neutral" },
  { value: "sent", label: "Envoyée", tone: "info" },
  { value: "partial", label: "Partiellement payée", tone: "warning" },
  { value: "paid", label: "Payée", tone: "success" },
  { value: "overdue", label: "En retard", tone: "danger" },
  { value: "cancelled", label: "Annulée", tone: "neutral" },
];

export const INVOICE_KIND: Option[] = [
  { value: "full", label: "Facture" },
  { value: "deposit", label: "Facture d'acompte" },
  { value: "balance", label: "Facture de solde" },
  { value: "credit_note", label: "Note de crédit" },
];

export const PAYMENT_METHOD: Option[] = [
  { value: "twint", label: "TWINT" },
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "bank_transfer", label: "Virement" },
  { value: "qr_bill", label: "QR-facture" },
  { value: "other", label: "Autre" },
];

/* ──────────────────────────── Demandes ───────────────────────────── */

export const REQUEST_STATUS: Option[] = [
  { value: "new", label: "Nouvelle", tone: "accent" },
  { value: "reviewing", label: "En cours d'examen", tone: "info" },
  { value: "converted", label: "Convertie", tone: "success" },
  { value: "declined", label: "Déclinée", tone: "neutral" },
];

/* ──────────────────────────── Messagerie ─────────────────────────── */

export const MESSAGE_STATUS: Option[] = [
  { value: "draft", label: "Brouillon", tone: "neutral" },
  { value: "queued", label: "En file d'attente", tone: "info" },
  { value: "sent", label: "Envoyé", tone: "success" },
  { value: "simulated", label: "Non envoyé (SMTP absent)", tone: "warning" },
  { value: "failed", label: "Échec", tone: "danger" },
  { value: "received", label: "Reçu", tone: "info" },
];

export const TEMPLATE_CATEGORY: Option[] = [
  { value: "quote", label: "Devis" },
  { value: "invoice", label: "Facture" },
  { value: "appointment", label: "Rendez-vous" },
  { value: "aftercare", label: "Cicatrisation" },
  { value: "general", label: "Général" },
];

/* ───────────────────────────── Helpers ───────────────────────────── */

export function labelOf(options: Option[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function toneOf(options: Option[], value: string | null | undefined): Tone {
  if (!value) return "neutral";
  return options.find((option) => option.value === value)?.tone ?? "neutral";
}

/** Variables utilisables dans les modèles d'e-mails. */
export const TEMPLATE_VARIABLES = [
  { key: "prenom", label: "Prénom du client" },
  { key: "nom", label: "Nom du client" },
  { key: "salon", label: "Nom du salon" },
  { key: "tatoueur", label: "Nom du tatoueur" },
  { key: "date_rdv", label: "Date du rendez-vous" },
  { key: "heure_rdv", label: "Heure du rendez-vous" },
  { key: "projet", label: "Titre du projet" },
  { key: "montant", label: "Montant total" },
  { key: "acompte", label: "Montant de l'acompte" },
  { key: "numero", label: "Numéro du document" },
  { key: "echeance", label: "Date d'échéance" },
  { key: "lien", label: "Lien de consultation" },
  { key: "signature", label: "Signature" },
] as const;

export const VAT_INFO = {
  standardRate: 8.1,
  reducedRate: 2.6,
  lodgingRate: 3.8,
  thresholdCents: 10_000_000, // CHF 100'000
} as const;
