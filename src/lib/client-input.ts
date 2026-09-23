/**
 * Aides de saisie pour la fiche client.
 *
 * Module sans dépendance serveur : il est utilisé dans le navigateur pour
 * valider chaque étape de l'assistant avant de passer à la suivante.
 */

/* ─────────────────────────────── Noms ─────────────────────────────── */

/** Particules qui restent en minuscules à l'intérieur d'un nom. */
const NAME_PARTICLES = new Set([
  "de", "du", "des", "la", "le", "les", "von", "van", "der", "den",
  "di", "da", "dos", "del", "della", "zu",
]);

function capitalizeWord(word: string): string {
  if (!word) return word;
  // « d'amico » → « D'Amico » : la lettre après l'apostrophe prend aussi la majuscule.
  return word
    .split("'")
    .map((part) => part.charAt(0).toLocaleUpperCase("fr-CH") + part.slice(1))
    .join("'");
}

/**
 * Met en forme un nom propre saisi en vrac : « jean-marc de la tour » →
 * « Jean-Marc de la Tour ». Une casse volontairement mixte (« McLeod »,
 * « DiCaprio ») est laissée intacte.
 */
export function capitalizeName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const uniform =
    trimmed === trimmed.toLocaleLowerCase("fr-CH") ||
    trimmed === trimmed.toLocaleUpperCase("fr-CH");
  if (!uniform) return trimmed;

  return trimmed
    .toLocaleLowerCase("fr-CH")
    .split(" ")
    .map((word, wordIndex) =>
      word
        .split("-")
        .map((segment, segmentIndex) => {
          const isFirst = wordIndex === 0 && segmentIndex === 0;
          if (!isFirst && NAME_PARTICLES.has(segment)) return segment;
          if (!isFirst && /^d'./.test(segment)) return `d'${capitalizeWord(segment.slice(2))}`;
          return capitalizeWord(segment);
        })
        .join("-"),
    )
    .join(" ");
}

/* ────────────────────────────── E-mail ────────────────────────────── */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Fautes de frappe fréquentes sur les domaines, dont les suisses. */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.fr": "gmail.com",
  "gmail.ch": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "bluwin.ch": "bluewin.ch",
  "bleuwin.ch": "bluewin.ch",
  "bluewin.com": "bluewin.ch",
  "sunrise.com": "sunrise.ch",
};

/** Propose une correction si le domaine ressemble à une faute de frappe. */
export function suggestEmailFix(value: string): string | null {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const fixed = DOMAIN_TYPOS[email.slice(at + 1)];
  return fixed ? `${email.slice(0, at)}@${fixed}` : null;
}

/* ──────────────────────────── Téléphone ──────────────────────────── */

export interface PhoneCountry {
  code: string;
  dial: string;
  label: string;
  /** Nombre de chiffres du numéro national, préfixe 0 exclu */
  min: number;
  max: number;
  /** Le 0 initial du numéro national disparaît en format international */
  trunkZero: boolean;
  /** Découpage d'affichage du numéro national (sans le 0) */
  groups?: number[];
  placeholder: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "CH", dial: "41", label: "Suisse", min: 9, max: 9, trunkZero: true, groups: [2, 3, 2, 2], placeholder: "079 123 45 67" },
  { code: "FR", dial: "33", label: "France", min: 9, max: 9, trunkZero: true, groups: [1, 2, 2, 2, 2], placeholder: "06 12 34 56 78" },
  { code: "DE", dial: "49", label: "Allemagne", min: 6, max: 13, trunkZero: true, placeholder: "0151 23456789" },
  { code: "IT", dial: "39", label: "Italie", min: 6, max: 11, trunkZero: false, placeholder: "312 345 6789" },
  { code: "AT", dial: "43", label: "Autriche", min: 6, max: 13, trunkZero: true, placeholder: "0664 1234567" },
  { code: "LI", dial: "423", label: "Liechtenstein", min: 7, max: 7, trunkZero: false, groups: [3, 2, 2], placeholder: "234 56 78" },
];

/** Choix « Autre » : le numéro doit alors être saisi avec son indicatif. */
export const PHONE_OTHER = "OTHER";

export function findPhoneCountry(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((country) => country.code === code);
}

function isInternational(raw: string) {
  return raw.startsWith("+") || raw.startsWith("00");
}

function internationalDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return raw.startsWith("00") ? digits.slice(2) : digits;
}

function splitGroups(digits: string, groups?: number[]): string {
  if (!groups || groups.reduce((sum, n) => sum + n, 0) !== digits.length) return digits;
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  return parts.join(" ");
}

/** « 41791234567 » → « +41 79 123 45 67 » */
function formatInternational(digits: string): string {
  const byLongestDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of byLongestDial) {
    if (digits.startsWith(country.dial)) {
      const national = digits.slice(country.dial.length);
      return `+${country.dial} ${splitGroups(national, country.groups)}`;
    }
  }
  return `+${digits}`;
}

/**
 * Numéro complet au format international, tel qu'il est enregistré.
 * « 079 123 45 67 » avec l'indicatif suisse → « +41 79 123 45 67 ».
 */
export function buildPhone(countryCode: string, local: string): string {
  const raw = local.trim();
  if (!raw) return "";
  if (isInternational(raw)) return formatInternational(internationalDigits(raw));

  const country = findPhoneCountry(countryCode);
  if (!country) return raw;

  let digits = raw.replace(/\D/g, "");
  if (country.trunkZero && digits.startsWith("0")) digits = digits.slice(1);
  return formatInternational(country.dial + digits);
}

/** Remet en forme la saisie locale à la sortie du champ : « 0791234567 » → « 079 123 45 67 ». */
export function formatNationalPhone(countryCode: string, local: string): string {
  const raw = local.trim();
  if (!raw || isInternational(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (countryCode === "CH" && /^0\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  }
  if (countryCode === "CH" && /^[1-9]\d{8}$/.test(digits)) {
    return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }
  if (countryCode === "FR" && /^0\d{9}$/.test(digits)) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  return raw;
}

/** Message d'erreur, ou `null` si le numéro est plausible (ou vide). */
export function validatePhone(countryCode: string, local: string): string | null {
  const raw = local.trim();
  if (!raw) return null;

  if (/[^\d\s+().\-/]/.test(raw)) {
    return "Le numéro contient des caractères qui ne sont pas des chiffres.";
  }

  if (isInternational(raw)) {
    const digits = internationalDigits(raw);
    if (digits.length < 8) return "Numéro international incomplet.";
    if (digits.length > 15) return "Numéro trop long, vérifie la saisie.";
    return null;
  }

  const country = findPhoneCountry(countryCode);
  if (!country) {
    return "Pour un autre pays, saisis le numéro complet avec son indicatif (ex. +44…).";
  }

  let digits = raw.replace(/\D/g, "");
  if (country.trunkZero && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length < country.min) {
    const missing = country.min - digits.length;
    return country.min === country.max
      ? `Il manque ${missing} chiffre${missing > 1 ? "s" : ""}.`
      : "Numéro trop court.";
  }
  if (digits.length > country.max) return "Numéro trop long, vérifie la saisie.";
  return null;
}

/* ───────────────────────────── Instagram ───────────────────────────── */

const INSTAGRAM_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

/** Accepte « @pseudo », « pseudo » ou un lien de profil collé tel quel. */
export function normalizeInstagram(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
}

export function isValidInstagram(value: string): boolean {
  return INSTAGRAM_PATTERN.test(value);
}

/* ─────────────────────────── Code postal ─────────────────────────── */

export const ADDRESS_COUNTRIES = [
  { value: "CH", label: "Suisse" },
  { value: "LI", label: "Liechtenstein" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Allemagne" },
  { value: "IT", label: "Italie" },
  { value: "AT", label: "Autriche" },
  { value: "other", label: "Autre pays" },
];

export function validatePostalCode(country: string, value: string): string | null {
  const code = value.trim();
  if (!code) return "Le NPA est requis.";
  switch (country) {
    case "CH":
    case "LI":
      return /^\d{4}$/.test(code) ? null : "Un NPA suisse compte 4 chiffres.";
    case "AT":
      return /^\d{4}$/.test(code) ? null : "Un code postal autrichien compte 4 chiffres.";
    case "FR":
    case "DE":
    case "IT":
      return /^\d{5}$/.test(code) ? null : "Ce code postal doit compter 5 chiffres.";
    default:
      return null;
  }
}

/* ───────────────────────── Date de naissance ───────────────────────── */

export interface BirthParts {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_BIRTH: BirthParts = { day: "", month: "", year: "" };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Date ISO (AAAA-MM-JJ) si la date est complète et existe, sinon `null`. */
export function birthPartsToIso(parts: BirthParts): string | null {
  if (!/^\d{1,2}$/.test(parts.day) || !/^\d{1,2}$/.test(parts.month)) return null;
  if (!/^\d{4}$/.test(parts.year)) return null;

  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Rejette le 31 février, le 31 avril, etc.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function ageFromIso(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const today = new Date();
  let years = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) years--;
  return years;
}

export function validateBirthParts(parts: BirthParts): string | null {
  if (!parts.day && !parts.month && !parts.year) {
    return "La date de naissance est requise pour vérifier l'âge.";
  }
  if (!parts.day || !parts.month || parts.year.length !== 4) {
    return "Date incomplète : jour, mois et année sur 4 chiffres.";
  }

  const iso = birthPartsToIso(parts);
  if (!iso) return "Cette date n'existe pas.";

  const years = ageFromIso(iso);
  if (years < 0) return "La date ne peut pas être dans le futur.";
  if (years > 110) return "Vérifie l'année : plus de 110 ans.";
  return null;
}
