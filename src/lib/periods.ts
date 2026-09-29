/**
 * Périodes de suivi (factures, dépenses) : semaine, mois, trimestre, année,
 * tout, ou dates choisies. Calculées en heure locale (Europe/Zurich sur le VPS).
 *
 * Paramètres d'adresse : ?periode=mois&date=2026-09-15 (date de référence),
 * ou ?periode=perso&du=2026-09-01&au=2026-09-30.
 */

export const PERIOD_KINDS = ["semaine", "mois", "trimestre", "annee", "tout", "perso"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  semaine: "Semaine",
  mois: "Mois",
  trimestre: "Trimestre",
  annee: "Année",
  tout: "Tout",
  perso: "Dates",
};

export interface Bucket {
  start: Date;
  /** Exclu */
  end: Date;
  /** Libellé sous la colonne */
  label: string;
  /** Libellé complet (infobulle) */
  title: string;
}

export interface Period {
  kind: PeriodKind;
  /** Début inclus ; null pour « tout » */
  start: Date | null;
  /** Fin exclue ; null pour « tout » */
  end: Date | null;
  label: string;
  /** Date de référence (AAAA-MM-JJ) pour la navigation */
  anchor: string;
  /** Paramètres des périodes précédente et suivante, si la navigation a un sens */
  previous: Record<string, string> | null;
  next: Record<string, string> | null;
  from: string;
  to: string;
}

const DAY = 24 * 60 * 60 * 1000;

function day(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, date] = value.split("-").map(Number);
  const result = new Date(year, month - 1, date);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

function addDaysLocal(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function mondayOf(date: Date) {
  const offset = (date.getDay() + 6) % 7;
  return addDaysLocal(date, -offset);
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-CH", options);
const dayMonth = fmt({ day: "numeric", month: "short" });
const dayMonthYear = fmt({ day: "numeric", month: "short", year: "numeric" });
const monthYear = fmt({ month: "long", year: "numeric" });
const monthShort = fmt({ month: "short" });
const numeric = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const weekday = fmt({ weekday: "short", day: "numeric" });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function resolvePeriod(
  params: { periode?: string; date?: string; du?: string; au?: string },
  now = new Date(),
): Period {
  const kind: PeriodKind = PERIOD_KINDS.includes(params.periode as PeriodKind)
    ? (params.periode as PeriodKind)
    : "mois";
  const anchorDate = day(params.date) ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchor = dayKey(anchorDate);
  const nav = (date: Date) => ({ periode: kind, date: dayKey(date) });

  if (kind === "semaine") {
    const start = mondayOf(anchorDate);
    const end = addDaysLocal(start, 7);
    const last = addDaysLocal(end, -1);
    return {
      kind,
      start,
      end,
      label: `Semaine du ${dayMonth.format(start)} au ${dayMonthYear.format(last)}`,
      anchor,
      previous: nav(addDaysLocal(start, -7)),
      next: nav(end),
      from: dayKey(start),
      to: dayKey(last),
    };
  }

  if (kind === "trimestre") {
    const quarter = Math.floor(anchorDate.getMonth() / 3);
    const start = new Date(anchorDate.getFullYear(), quarter * 3, 1);
    const end = new Date(anchorDate.getFullYear(), quarter * 3 + 3, 1);
    return {
      kind,
      start,
      end,
      label: `${quarter === 0 ? "1er" : `${quarter + 1}e`} trimestre ${start.getFullYear()}`,
      anchor,
      previous: nav(new Date(start.getFullYear(), start.getMonth() - 3, 1)),
      next: nav(end),
      from: dayKey(start),
      to: dayKey(addDaysLocal(end, -1)),
    };
  }

  if (kind === "annee") {
    const start = new Date(anchorDate.getFullYear(), 0, 1);
    const end = new Date(anchorDate.getFullYear() + 1, 0, 1);
    return {
      kind,
      start,
      end,
      label: `Année ${start.getFullYear()}`,
      anchor,
      previous: nav(new Date(start.getFullYear() - 1, 0, 1)),
      next: nav(end),
      from: dayKey(start),
      to: dayKey(addDaysLocal(end, -1)),
    };
  }

  if (kind === "tout") {
    return {
      kind,
      start: null,
      end: null,
      label: "Depuis le début",
      anchor,
      previous: null,
      next: null,
      from: "",
      to: "",
    };
  }

  if (kind === "perso") {
    let start = day(params.du) ?? new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    let last = day(params.au) ?? anchorDate;
    if (last < start) [start, last] = [last, start];
    return {
      kind,
      start,
      end: addDaysLocal(last, 1),
      label: `Du ${numeric.format(start)} au ${numeric.format(last)}`,
      anchor,
      previous: null,
      next: null,
      from: dayKey(start),
      to: dayKey(last),
    };
  }

  // Mois (par défaut)
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
  return {
    kind,
    start,
    end,
    label: capitalize(monthYear.format(start)),
    anchor,
    previous: nav(new Date(start.getFullYear(), start.getMonth() - 1, 1)),
    next: nav(end),
    from: dayKey(start),
    to: dayKey(addDaysLocal(end, -1)),
  };
}

/** Filtre Prisma sur une date pour la période (aucun filtre pour « tout »). */
export function periodWhere(period: Period) {
  return period.start && period.end ? { gte: period.start, lt: period.end } : undefined;
}

/**
 * Découpage de la période en colonnes pour le graphique : jours d'une semaine,
 * semaines d'un mois, mois d'un trimestre ou d'une année, années pour « tout ».
 */
export function bucketsFor(period: Period, earliest: Date | null, now = new Date()): Bucket[] {
  const start = period.start ?? (earliest ? new Date(earliest.getFullYear(), 0, 1) : new Date(now.getFullYear(), 0, 1));
  const end = period.end ?? new Date(now.getFullYear() + 1, 0, 1);
  const span = (end.getTime() - start.getTime()) / DAY;

  const unit =
    period.kind === "semaine"
      ? "day"
      : period.kind === "mois"
        ? "week"
        : period.kind === "trimestre" || period.kind === "annee"
          ? "month"
          : period.kind === "tout"
            ? "year"
            : span <= 14
              ? "day"
              : span <= 92
                ? "week"
                : span <= 731
                  ? "month"
                  : "year";

  const buckets: Bucket[] = [];
  let cursor = start;
  while (cursor < end && buckets.length < 60) {
    let next: Date;
    let label: string;
    let title: string;
    if (unit === "day") {
      next = addDaysLocal(cursor, 1);
      label = capitalize(weekday.format(cursor));
      title = capitalize(fmt({ weekday: "long", day: "numeric", month: "long" }).format(cursor));
    } else if (unit === "week") {
      next = addDaysLocal(mondayOf(cursor), 7);
      if (next > end) next = end;
      const last = addDaysLocal(next, -1);
      label = `${cursor.getDate()}–${last.getDate()}`;
      title = `Du ${dayMonth.format(cursor)} au ${dayMonth.format(last)}`;
    } else if (unit === "month") {
      next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      if (next > end) next = end;
      label = capitalize(monthShort.format(cursor).replace(".", ""));
      title = capitalize(monthYear.format(cursor));
    } else {
      next = new Date(cursor.getFullYear() + 1, 0, 1);
      if (next > end) next = end;
      label = String(cursor.getFullYear());
      title = `Année ${cursor.getFullYear()}`;
    }
    buckets.push({ start: cursor, end: next, label, title });
    cursor = next;
  }
  return buckets;
}

/** Somme des montants par colonne. */
export function sumByBucket<T>(
  buckets: Bucket[],
  rows: T[],
  dateOf: (row: T) => Date,
  amountOf: (row: T) => number,
) {
  const totals = buckets.map(() => 0);
  for (const row of rows) {
    const time = dateOf(row).getTime();
    const index = buckets.findIndex(
      (bucket) => time >= bucket.start.getTime() && time < bucket.end.getTime(),
    );
    if (index >= 0) totals[index] += amountOf(row);
  }
  return totals;
}

const PERIOD_PARAMS = ["periode", "date", "du", "au"];

/**
 * Liens du sélecteur de période : chaque lien garde la recherche et les filtres
 * en cours, et la date de référence (passer de « mois » à « année » reste sur
 * la même année).
 */
export function periodLinks(
  basePath: string,
  params: Record<string, string | undefined>,
  period: Period,
) {
  const keep = Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] => Boolean(entry[1]) && !PERIOD_PARAMS.includes(entry[0]),
    ),
  );
  const href = (extra: Record<string, string>) => {
    const query = new URLSearchParams({ ...keep, ...extra }).toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const range: Record<string, string> =
    period.from && period.to ? { du: period.from, au: period.to } : {};

  return {
    kind: period.kind,
    label: period.label,
    kindHrefs: Object.fromEntries(
      PERIOD_KINDS.map((kind) => [
        kind,
        kind === "tout"
          ? href({ periode: "tout" })
          : kind === "perso"
            ? href({ periode: "perso", ...range })
            : href({ periode: kind, date: period.anchor }),
      ]),
    ) as Record<PeriodKind, string>,
    previousHref: period.previous ? href(period.previous) : null,
    nextHref: period.next ? href(period.next) : null,
    todayHref: href({ periode: period.kind }),
    customBase: href({ periode: "perso" }),
    from: period.from,
    to: period.to,
  };
}
