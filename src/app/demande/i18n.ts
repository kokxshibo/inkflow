/**
 * Textes du formulaire public de demande, en français (par défaut), allemand
 * (orthographe suisse : « ss » plutôt que « ß ») et anglais.
 *
 * Les valeurs enregistrées (rendu, style, budget) restent les mêmes quelle
 * que soit la langue : seuls les libellés affichés changent. L'emplacement est
 * un texte libre, écrit par le client.
 */

export const LANGUAGES = ["fr", "de", "en"] as const;
export type Lang = (typeof LANGUAGES)[number];

export function parseLang(value: unknown): Lang {
  return LANGUAGES.includes(value as Lang) ? (value as Lang) : "fr";
}

export const LANGUAGE_NAMES: Record<Lang, string> = {
  fr: "Français",
  de: "Deutsch",
  en: "English",
};

type Labels = Record<string, Record<Lang, string>>;

export const COLOR_LABELS: Labels = {
  blackgrey: { fr: "Noir & gris", de: "Schwarz-Grau", en: "Black & grey" },
  color: { fr: "Couleur", de: "Farbe", en: "Colour" },
  dotwork: { fr: "Dotwork", de: "Dotwork", en: "Dotwork" },
};

export const STYLE_LABELS: Labels = {
  realisme: { fr: "Réalisme", de: "Realismus", en: "Realism" },
  old_school: { fr: "Old school", de: "Old School", en: "Old school" },
  neo_trad: { fr: "Néo-traditionnel", de: "Neo Traditional", en: "Neo-traditional" },
  blackwork: { fr: "Blackwork", de: "Blackwork", en: "Blackwork" },
  fine_line: { fr: "Fine line", de: "Fineline", en: "Fine line" },
  japonais: { fr: "Japonais", de: "Japanisch", en: "Japanese" },
  lettrage: { fr: "Lettrage", de: "Schriftzug", en: "Lettering" },
  ornemental: { fr: "Ornemental", de: "Ornamental", en: "Ornamental" },
  geometrique: { fr: "Géométrique", de: "Geometrisch", en: "Geometric" },
  aquarelle: { fr: "Aquarelle", de: "Aquarell", en: "Watercolour" },
  tribal: { fr: "Tribal", de: "Tribal", en: "Tribal" },
  autre: { fr: "Autre", de: "Anderer Stil", en: "Other" },
};

/** La valeur enregistrée est le libellé français, lu par le tatoueur. */
export const BUDGET_LABELS: Labels = {
  "Moins de 300 CHF": { fr: "Moins de 300 CHF", de: "Weniger als 300 CHF", en: "Under 300 CHF" },
  "300 – 600 CHF": { fr: "300 – 600 CHF", de: "300 – 600 CHF", en: "300 – 600 CHF" },
  "600 – 1'000 CHF": { fr: "600 – 1'000 CHF", de: "600 – 1'000 CHF", en: "600 – 1'000 CHF" },
  "1'000 – 2'000 CHF": { fr: "1'000 – 2'000 CHF", de: "1'000 – 2'000 CHF", en: "1'000 – 2'000 CHF" },
  "Plus de 2'000 CHF": { fr: "Plus de 2'000 CHF", de: "Mehr als 2'000 CHF", en: "Over 2'000 CHF" },
  "Je ne sais pas encore": { fr: "Je ne sais pas encore", de: "Weiss ich noch nicht", en: "Not sure yet" },
};

export function translatedOptions(labels: Labels, lang: Lang) {
  return Object.entries(labels).map(([value, label]) => ({ value, label: label[lang] }));
}

const DICTIONARY = {
  fr: {
    metaTitle: (name: string) => `Demander un tatouage — ${name}`,
    metaDescription: (name: string) =>
      `Décris ton projet de tatouage et envoie tes références à ${name}.`,
    language: "Langue",
    title: "Parle-moi de ton projet",
    intro:
      "Remplis ce formulaire plutôt que de m'écrire en message privé : je reçois tout au même endroit, rien ne se perd, et je te réponds plus vite.",
    greeting: (firstName: string | undefined, instagram: boolean) =>
      `${firstName ? `Salut ${firstName} ! ` : ""}Suite à ton message ${
        instagram ? "sur Instagram" : "par e-mail"
      }, voici le formulaire pour me présenter ton projet.`,
    privacy: (email: string | null) =>
      `Tes données sont utilisées uniquement pour traiter ta demande et ne sont jamais transmises à des tiers. Tu peux demander leur suppression à tout moment${
        email ? ` en écrivant à ${email}` : ""
      }.`,
    who: "Qui es-tu ?",
    firstName: "Prénom",
    lastName: "Nom",
    email: "E-mail",
    phone: "Téléphone",
    optional: "Facultatif",
    instagramHint: "Facultatif, sans le @",
    birthDate: "Date de naissance",
    project: "Ton projet",
    projectIntro: "Plus tu es précis·e, plus la réponse sera rapide.",
    zoneQuestion: "Où veux-tu ton tatouage ?",
    zoneHint: "Avec tes mots : le côté, la hauteur, la surface à couvrir…",
    zonePlaceholder: "Intérieur de l'avant-bras gauche",
    bodyPhoto: "Photo de l'emplacement",
    bodyPhotoHint:
      "Prends en photo la partie du corps à tatouer, bien éclairée et en entier : je verrai la taille et l'endroit exact.",
    addBodyPhoto: "Prendre ou choisir une photo",
    addMoreBodyPhotos: "Ajouter une autre photo",
    bodyPhotoFormats: "Jusqu'à 3 photos · JPG, PNG ou WebP",
    description: "Décris ton idée",
    descriptionHint: "Le motif, l'ambiance, ce que ça représente pour toi, ce que tu veux éviter…",
    descriptionPlaceholder:
      "J'aimerais une carpe koï qui remonte le bras, avec des vagues en fond et des feuilles d'érable. Plutôt dans un style japonais traditionnel. J'aimerais éviter le rouge vif.",
    images: "Tes images d'inspiration",
    imagesHint: "Jusqu'à 6 images : inspirations, croquis, tatouages qui te plaisent.",
    addImages: "Ajouter des images",
    addMoreImages: "Ajouter d'autres images",
    imageFormats: "JPG, PNG ou WebP",
    removeImage: "Retirer cette image",
    unsupportedImage: "Ce format d'image n'est pas pris en charge : utilise une photo JPG, PNG ou WebP.",
    imageTooLarge: "Une image dépasse 8 Mo et n'a pas pu être ajoutée.",
    preparingImages: "Préparation des photos…",
    imagesTooHeavy: "Tes images sont trop lourdes au total : retires-en une ou deux, puis renvoie.",
    details: "Quelques précisions",
    detailsIntro: "Facultatif, mais ça m'aide à te répondre plus vite.",
    size: "Taille approximative",
    sizeHint: "Par exemple : 15 x 20 cm",
    colorMode: "Rendu souhaité",
    style: "Style",
    stylePlaceholder: "Je fais confiance",
    budget: "Budget envisagé",
    budgetPlaceholder: "Non précisé",
    availability: "Tes disponibilités",
    availabilityPlaceholder: "Plutôt en semaine, après 16 h",
    checks: "Quelques vérifications",
    medical: "J'ai une condition médicale à signaler",
    medicalHint:
      "Allergie, traitement en cours, grossesse, problème de peau, trouble de la coagulation…",
    medicalDetail: "Précise",
    medicalDetailHint:
      "Cette information reste confidentielle et sert uniquement à la sécurité de la séance.",
    medicalPlaceholder: "Allergie au latex, traitement anticoagulant…",
    adult: "Je certifie être majeur·e (18 ans révolus)",
    adultHint: "Une pièce d'identité pourra t'être demandée le jour de la séance.",
    consent: "J'accepte que mes données soient utilisées pour traiter ma demande",
    consentHint:
      "Elles ne servent qu'à ça, ne sont jamais transmises à des tiers, et je peux demander leur suppression à tout moment.",
    submit: "Envoyer ma demande",
    afterSubmit: "Je te réponds dès que possible.",
    successTitle: "Demande envoyée",
    successText: (name: string) =>
      `Merci ! Ta demande est bien arrivée chez ${name}. Je te réponds dès que possible, en général sous quelques jours. Si ma réponse arrive par e-mail, pense à vérifier tes indésirables.`,
    errors: {
      general: "Certains champs doivent être corrigés.",
      firstName: "Ton prénom est requis",
      lastName: "Ton nom est requis",
      email: "Adresse e-mail invalide",
      description: "Décris ton projet en quelques phrases (20 caractères minimum)",
      bodyZone: "120 caractères maximum",
      isAdult: "Tu dois être majeur·e pour te faire tatouer",
      consentGiven: "Ton accord est nécessaire pour traiter ta demande",
    },
  },
  de: {
    metaTitle: (name: string) => `Tattoo anfragen — ${name}`,
    metaDescription: (name: string) =>
      `Beschreibe dein Tattoo-Projekt und sende deine Referenzen an ${name}.`,
    language: "Sprache",
    title: "Erzähl mir von deinem Projekt",
    intro:
      "Fülle dieses Formular aus, statt mir eine Privatnachricht zu schreiben: So kommt alles an einem Ort an, nichts geht verloren und ich kann dir schneller antworten.",
    greeting: (firstName: string | undefined, instagram: boolean) =>
      `${firstName ? `Hallo ${firstName}! ` : ""}Danke für deine Nachricht ${
        instagram ? "auf Instagram" : "per E-Mail"
      }. Hier kannst du mir dein Projekt vorstellen.`,
    privacy: (email: string | null) =>
      `Deine Daten werden nur zur Bearbeitung deiner Anfrage verwendet und niemals an Dritte weitergegeben. Du kannst jederzeit ihre Löschung verlangen${
        email ? `, indem du an ${email} schreibst` : ""
      }.`,
    who: "Wer bist du?",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    phone: "Telefon",
    optional: "Optional",
    instagramHint: "Optional, ohne @",
    birthDate: "Geburtsdatum",
    project: "Dein Projekt",
    projectIntro: "Je genauer du bist, desto schneller kann ich dir antworten.",
    zoneQuestion: "Wo möchtest du dein Tattoo?",
    zoneHint: "In deinen Worten: die Seite, die Höhe, die Fläche …",
    zonePlaceholder: "Innenseite des linken Unterarms",
    bodyPhoto: "Foto der Stelle",
    bodyPhotoHint:
      "Fotografiere die Körperstelle, die tätowiert werden soll, gut beleuchtet und vollständig: So sehe ich die Grösse und die genaue Stelle.",
    addBodyPhoto: "Foto aufnehmen oder auswählen",
    addMoreBodyPhotos: "Weiteres Foto hinzufügen",
    bodyPhotoFormats: "Bis zu 3 Fotos · JPG, PNG oder WebP",
    description: "Beschreibe deine Idee",
    descriptionHint: "Das Motiv, die Stimmung, was es dir bedeutet, was du vermeiden möchtest …",
    descriptionPlaceholder:
      "Ich hätte gerne einen Koi-Karpfen, der den Arm hinaufschwimmt, mit Wellen im Hintergrund und Ahornblättern. Eher im traditionellen japanischen Stil. Knalliges Rot möchte ich vermeiden.",
    images: "Deine Inspirationsbilder",
    imagesHint: "Bis zu 6 Bilder: Inspirationen, Skizzen, Tattoos, die dir gefallen.",
    addImages: "Bilder hinzufügen",
    addMoreImages: "Weitere Bilder hinzufügen",
    imageFormats: "JPG, PNG oder WebP",
    removeImage: "Bild entfernen",
    unsupportedImage: "Dieses Bildformat wird nicht unterstützt: Bitte verwende ein JPG-, PNG- oder WebP-Foto.",
    imageTooLarge: "Ein Bild ist grösser als 8 MB und konnte nicht hinzugefügt werden.",
    preparingImages: "Fotos werden vorbereitet …",
    imagesTooHeavy: "Deine Bilder sind insgesamt zu gross: Entferne ein oder zwei und sende erneut.",
    details: "Ein paar Details",
    detailsIntro: "Optional, aber so kann ich dir schneller antworten.",
    size: "Ungefähre Grösse",
    sizeHint: "Zum Beispiel: 15 x 20 cm",
    colorMode: "Gewünschte Ausführung",
    style: "Stil",
    stylePlaceholder: "Ich vertraue dir",
    budget: "Geplantes Budget",
    budgetPlaceholder: "Keine Angabe",
    availability: "Deine Verfügbarkeit",
    availabilityPlaceholder: "Eher unter der Woche, nach 16 Uhr",
    checks: "Noch ein paar Punkte",
    medical: "Ich habe eine gesundheitliche Besonderheit zu melden",
    medicalHint:
      "Allergie, laufende Behandlung, Schwangerschaft, Hautprobleme, Gerinnungsstörung …",
    medicalDetail: "Bitte präzisieren",
    medicalDetailHint:
      "Diese Angabe bleibt vertraulich und dient nur der Sicherheit der Sitzung.",
    medicalPlaceholder: "Latexallergie, Blutverdünner …",
    adult: "Ich bestätige, dass ich volljährig bin (mindestens 18 Jahre alt)",
    adultHint: "Am Tag der Sitzung kann ein Ausweis verlangt werden.",
    consent: "Ich bin einverstanden, dass meine Daten zur Bearbeitung meiner Anfrage verwendet werden",
    consentHint:
      "Sie werden nur dafür verwendet, nie an Dritte weitergegeben, und ich kann jederzeit ihre Löschung verlangen.",
    submit: "Anfrage senden",
    afterSubmit: "Ich melde mich so bald wie möglich.",
    successTitle: "Anfrage gesendet",
    successText: (name: string) =>
      `Danke! Deine Anfrage ist bei ${name} angekommen. Ich melde mich so bald wie möglich, meistens innerhalb weniger Tage. Falls meine Antwort per E-Mail kommt, schau bitte auch in deinen Spam-Ordner.`,
    errors: {
      general: "Einige Felder müssen korrigiert werden.",
      firstName: "Bitte gib deinen Vornamen an",
      lastName: "Bitte gib deinen Nachnamen an",
      email: "Ungültige E-Mail-Adresse",
      description: "Beschreibe dein Projekt in ein paar Sätzen (mindestens 20 Zeichen)",
      bodyZone: "Höchstens 120 Zeichen",
      isAdult: "Du musst volljährig sein, um dich tätowieren zu lassen",
      consentGiven: "Deine Zustimmung ist nötig, um deine Anfrage zu bearbeiten",
    },
  },
  en: {
    metaTitle: (name: string) => `Request a tattoo — ${name}`,
    metaDescription: (name: string) =>
      `Describe your tattoo project and send your references to ${name}.`,
    language: "Language",
    title: "Tell me about your project",
    intro:
      "Fill in this form rather than sending me a private message: everything arrives in one place, nothing gets lost, and I can reply faster.",
    greeting: (firstName: string | undefined, instagram: boolean) =>
      `${firstName ? `Hi ${firstName}! ` : ""}Following your message ${
        instagram ? "on Instagram" : "by email"
      }, here is the form to tell me about your project.`,
    privacy: (email: string | null) =>
      `Your data is only used to handle your request and is never shared with third parties. You can ask for it to be deleted at any time${
        email ? ` by writing to ${email}` : ""
      }.`,
    who: "Who are you?",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    optional: "Optional",
    instagramHint: "Optional, without the @",
    birthDate: "Date of birth",
    project: "Your project",
    projectIntro: "The more precise you are, the faster I can reply.",
    zoneQuestion: "Where would you like your tattoo?",
    zoneHint: "In your own words: the side, the height, the area to cover…",
    zonePlaceholder: "Inside of the left forearm",
    bodyPhoto: "Photo of the area",
    bodyPhotoHint:
      "Take a photo of the part of your body you want tattooed, well lit and in full: I'll see the exact size and spot.",
    addBodyPhoto: "Take or choose a photo",
    addMoreBodyPhotos: "Add another photo",
    bodyPhotoFormats: "Up to 3 photos · JPG, PNG or WebP",
    description: "Describe your idea",
    descriptionHint: "The design, the mood, what it means to you, what you'd like to avoid…",
    descriptionPlaceholder:
      "I'd like a koi carp swimming up the arm, with waves in the background and maple leaves. Rather in a traditional Japanese style. I'd like to avoid bright red.",
    images: "Your inspiration images",
    imagesHint: "Up to 6 images: inspiration, sketches, tattoos you like.",
    addImages: "Add images",
    addMoreImages: "Add more images",
    imageFormats: "JPG, PNG or WebP",
    removeImage: "Remove this image",
    unsupportedImage: "This image format isn't supported: please use a JPG, PNG or WebP photo.",
    imageTooLarge: "An image is larger than 8 MB and couldn't be added.",
    preparingImages: "Preparing photos…",
    imagesTooHeavy: "Your images are too large in total: remove one or two, then send again.",
    details: "A few details",
    detailsIntro: "Optional, but it helps me reply faster.",
    size: "Approximate size",
    sizeHint: "For example: 15 x 20 cm",
    colorMode: "Preferred look",
    style: "Style",
    stylePlaceholder: "I trust you",
    budget: "Budget",
    budgetPlaceholder: "Not specified",
    availability: "Your availability",
    availabilityPlaceholder: "Preferably weekdays, after 4 pm",
    checks: "A few checks",
    medical: "I have a medical condition to report",
    medicalHint: "Allergy, ongoing treatment, pregnancy, skin condition, blood clotting disorder…",
    medicalDetail: "Please specify",
    medicalDetailHint:
      "This information stays confidential and is only used for the safety of the session.",
    medicalPlaceholder: "Latex allergy, blood thinners…",
    adult: "I confirm that I am an adult (18 or older)",
    adultHint: "You may be asked for ID on the day of the session.",
    consent: "I agree that my data is used to handle my request",
    consentHint:
      "It is used for nothing else, never shared with third parties, and I can ask for it to be deleted at any time.",
    submit: "Send my request",
    afterSubmit: "I'll get back to you as soon as possible.",
    successTitle: "Request sent",
    successText: (name: string) =>
      `Thank you! Your request has reached ${name}. I'll get back to you as soon as possible, usually within a few days. If my reply comes by email, please check your spam folder too.`,
    errors: {
      general: "Some fields need to be corrected.",
      firstName: "Please enter your first name",
      lastName: "Please enter your last name",
      email: "Invalid email address",
      description: "Describe your project in a few sentences (at least 20 characters)",
      bodyZone: "120 characters maximum",
      isAdult: "You must be an adult to get tattooed",
      consentGiven: "Your consent is needed to handle your request",
    },
  },
};

export type Dictionary = (typeof DICTIONARY)["fr"];

export function dictionary(lang: Lang): Dictionary {
  return DICTIONARY[lang];
}

/** Textes simples (sans fonction) transmis au composant client du formulaire. */
export type FormTexts = Omit<
  Dictionary,
  "metaTitle" | "metaDescription" | "greeting" | "privacy" | "successText" | "errors"
> & { successText: string };

/** Textes du formulaire pour le composant client (les fonctions restent côté serveur). */
export function formTexts(lang: Lang, name: string): FormTexts {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { metaTitle, metaDescription, greeting, privacy, successText, errors, ...plain } =
    DICTIONARY[lang];
  return { ...plain, successText: successText(name) };
}
