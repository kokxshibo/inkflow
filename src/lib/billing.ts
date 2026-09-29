import "server-only";
import type { Prisma, Settings } from "@prisma/client";
import { db } from "./db";
import { formatCHF, roundTo5Cents } from "./money";
import { formatDate, formatDuration, minutesBetween } from "./utils";
import { ALL_BODY_ZONES, COLOR_MODE, PROJECT_STYLE, labelOf } from "./constants";

/**
 * Facturation automatique.
 *
 * Tout ce qui se facture est déjà connu de l'application : le devis accepté,
 * les séances effectuées, le tarif horaire. Ce module en déduit les factures
 * à émettre, avec un montant calculé et expliqué — l'utilisateur n'a plus
 * qu'à confirmer.
 *
 * Règles de calcul, dans l'ordre :
 *  1. Acompte : devis accepté avec acompte, pas encore facturé.
 *  2. Séance effectuée non facturée :
 *     - s'il existe un prix convenu (devis accepté ou prix final du projet),
 *       le reste dû est réparti sur les séances restantes prévues. L'acompte
 *       est ainsi déduit automatiquement au fil des séances ;
 *     - sinon, durée de la séance × tarif horaire.
 *  3. Solde du projet : prix convenu moins tout ce qui a déjà été facturé,
 *     proposé dès qu'une séance a eu lieu. Le facturer rattache les séances
 *     restantes, qui ne sont alors plus proposées une à une.
 *  4. Devis libre (sans projet, un flash par exemple) accepté : son montant,
 *     acompte déduit, une fois l'acompte facturé s'il y en a un.
 */

export type SuggestionKind = "deposit" | "session" | "balance" | "quote";

export interface BillingSuggestion {
  /** « deposit:<devis> », « session:<rdv> », « balance:<projet> » ou « quote:<devis> » */
  key: string;
  kind: SuggestionKind;
  /** Nature de la facture qui sera émise */
  invoiceKind: "full" | "deposit" | "balance";
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  projectId: string | null;
  projectTitle: string | null;
  /** Désignation proposée pour la ligne de facture */
  label: string;
  description: string | null;
  /** Montant payé par le client, en centimes */
  amount: number;
  /** Comment le montant a été obtenu, en une phrase */
  explanation: string;
  /** Date de référence : séance, acceptation du devis… (ISO) */
  date: string;
  quoteId?: string;
  appointmentId?: string;
}

export interface SuggestionFilter {
  clientId?: string;
  projectId?: string;
  /** Limite le résultat à une suggestion précise */
  key?: string;
}

interface ProjectLedger {
  /** Prix convenu : devis accepté, ou à défaut prix final du projet */
  agreed: number | null;
  quoteNumber: string | null;
  /** Déjà facturé, hors factures annulées et notes de crédit */
  invoiced: number;
  estimatedSessions: number;
  /** Séances effectuées déjà rattachées à une facture valable */
  billedSessions: number;
  doneSessions: number;
}

const BILLED_STATUSES_EXCLUDED = ["cancelled"];

/** Séance effectuée encore à facturer (jamais, ou sur une facture annulée). */
export const UNBILLED_SESSION: Prisma.AppointmentWhereInput = {
  type: "session",
  status: "done",
  OR: [{ invoiceId: null }, { invoice: { status: "cancelled" } }],
};

/** Situation financière d'un ensemble de projets. */
async function loadLedgers(projectIds: string[]): Promise<Map<string, ProjectLedger>> {
  const ledgers = new Map<string, ProjectLedger>();
  if (projectIds.length === 0) return ledgers;

  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      finalPrice: true,
      estimatedSessions: true,
      quotes: {
        where: { status: "accepted" },
        orderBy: { acceptedAt: "desc" },
        take: 1,
        select: { total: true, number: true },
      },
      invoices: { select: { total: true, status: true, kind: true } },
      appointments: {
        where: { type: "session", status: "done" },
        select: { invoiceId: true, invoice: { select: { status: true } } },
      },
    },
  });

  for (const project of projects) {
    const quote = project.quotes[0];
    // Une note de crédit annule une facture qui passe elle-même en « annulée » :
    // on écarte les deux pour ne pas compter deux fois l'annulation.
    const invoiced = project.invoices
      .filter(
        (invoice) =>
          !BILLED_STATUSES_EXCLUDED.includes(invoice.status) &&
          invoice.kind !== "credit_note",
      )
      .reduce((sum, invoice) => sum + invoice.total, 0);

    ledgers.set(project.id, {
      agreed: quote?.total ?? project.finalPrice ?? null,
      quoteNumber: quote?.number ?? null,
      invoiced,
      estimatedSessions: Math.max(project.estimatedSessions, 1),
      billedSessions: project.appointments.filter(
        (session) => session.invoiceId && session.invoice?.status !== "cancelled",
      ).length,
      doneSessions: project.appointments.length,
    });
  }
  return ledgers;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** Prix d'une séance effectuée, avec son explication. */
function priceSession(
  minutes: number,
  settings: Pick<Settings, "hourlyRate" | "minimumPrice">,
  ledger: ProjectLedger | undefined,
): { amount: number; explanation: string } {
  if (ledger && ledger.agreed !== null) {
    const remaining = ledger.agreed - ledger.invoiced;
    const remainingSessions = ledger.estimatedSessions - ledger.billedSessions;

    if (remaining > 0 && remainingSessions > 0) {
      const amount =
        remainingSessions === 1 ? remaining : roundTo5Cents(remaining / remainingSessions);
      return {
        amount,
        explanation:
          remainingSessions === 1
            ? `Dernière séance prévue : reste dû sur les ${formatCHF(ledger.agreed)} convenus`
            : `${formatCHF(remaining)} restant sur ${formatCHF(ledger.agreed)}, réparti sur ${plural(remainingSessions, "séance")} prévue${remainingSessions > 1 ? "s" : ""}`,
      };
    }

    if (remaining > 0) {
      return {
        amount: remaining,
        explanation: `Séance au-delà des ${plural(ledger.estimatedSessions, "séance")} prévue${ledger.estimatedSessions > 1 ? "s" : ""} : reste dû sur le devis`,
      };
    }
  }

  const hourly = roundTo5Cents(Math.round((settings.hourlyRate * minutes) / 60));
  if (hourly < settings.minimumPrice) {
    return {
      amount: settings.minimumPrice,
      explanation: `Ton prix minimum (${formatDuration(minutes)} × ${formatCHF(settings.hourlyRate)} de l'heure = ${formatCHF(hourly)})`,
    };
  }
  return {
    amount: hourly,
    explanation: `${formatDuration(minutes)} × ${formatCHF(settings.hourlyRate)} de l'heure`,
  };
}

/** Tout ce qui peut être facturé maintenant, du plus récent au plus ancien. */
export async function getBillingSuggestions(
  settings: Settings,
  filter: SuggestionFilter = {},
): Promise<BillingSuggestion[]> {
  const [kindFilter, idFilter] = filter.key?.split(":") ?? [];
  const wants = (kind: SuggestionKind) => !kindFilter || kindFilter === kind;

  const scope = {
    ...(filter.clientId ? { clientId: filter.clientId } : {}),
    ...(filter.projectId ? { projectId: filter.projectId } : {}),
  };

  const [quotes, sessions, projects, freeQuotes] = await Promise.all([
    wants("deposit")
      ? db.quote.findMany({
          where: {
            ...scope,
            ...(kindFilter === "deposit" ? { id: idFilter } : {}),
            status: "accepted",
            depositAmount: { gt: 0 },
            invoices: { none: { kind: "deposit", status: { not: "cancelled" } } },
          },
          include: { client: true, project: true },
        })
      : [],
    wants("session")
      ? db.appointment.findMany({
          where: {
            ...scope,
            ...(kindFilter === "session" ? { id: idFilter } : {}),
            ...UNBILLED_SESSION,
            clientId: filter.clientId ?? { not: null },
          },
          include: { client: true, project: true },
          orderBy: { startAt: "asc" },
        })
      : [],
    wants("balance")
      ? db.project.findMany({
          where: {
            ...(filter.clientId ? { clientId: filter.clientId } : {}),
            ...(filter.projectId ? { id: filter.projectId } : {}),
            ...(kindFilter === "balance" ? { id: idFilter } : {}),
            status: { notIn: ["cancelled", "idea"] },
            OR: [{ quotes: { some: { status: "accepted" } } }, { finalPrice: { not: null } }],
          },
          include: { client: true },
        })
      : [],
    wants("quote")
      ? db.quote.findMany({
          where: {
            ...(filter.clientId ? { clientId: filter.clientId } : {}),
            ...(kindFilter === "quote" ? { id: idFilter } : {}),
            // Un devis rattaché à un projet est soldé via le projet.
            projectId: null,
            status: "accepted",
          },
          include: {
            client: true,
            items: { orderBy: { position: "asc" }, take: 1 },
            invoices: { select: { total: true, status: true, kind: true } },
          },
        })
      : [],
  ]);

  const projectIds = new Set<string>();
  for (const session of sessions) if (session.projectId) projectIds.add(session.projectId);
  for (const project of projects) projectIds.add(project.id);
  const ledgers = await loadLedgers([...projectIds]);

  const suggestions: BillingSuggestion[] = [];

  /* ── 1. Acomptes ── */
  for (const quote of quotes) {
    const percent = quote.total > 0 ? Math.round((quote.depositAmount / quote.total) * 100) : 0;
    suggestions.push({
      key: `deposit:${quote.id}`,
      kind: "deposit",
      invoiceKind: "deposit",
      clientId: quote.clientId,
      clientName: `${quote.client.firstName} ${quote.client.lastName}`,
      clientEmail: quote.client.email,
      projectId: quote.projectId,
      projectTitle: quote.project?.title ?? null,
      label: `Acompte sur devis ${quote.number}`,
      description: quote.project?.title ?? null,
      amount: quote.depositAmount,
      explanation: `${percent} % du devis de ${formatCHF(quote.total)}, accepté le ${formatDate(quote.acceptedAt ?? quote.issuedAt)}`,
      date: (quote.acceptedAt ?? quote.issuedAt).toISOString(),
      quoteId: quote.id,
    });
  }

  /* ── 2. Séances effectuées ── */
  for (const session of sessions) {
    if (!session.client) continue;
    const minutes = session.actualMinutes ?? minutesBetween(session.startAt, session.endAt);
    const ledger = session.projectId ? ledgers.get(session.projectId) : undefined;
    // Prix convenu entièrement facturé (solde émis) : la séance est déjà couverte.
    if (ledger && ledger.agreed !== null && ledger.agreed - ledger.invoiced <= 0) continue;
    const { amount, explanation } = priceSession(minutes, settings, ledger);

    suggestions.push({
      key: `session:${session.id}`,
      kind: "session",
      invoiceKind: "full",
      clientId: session.client.id,
      clientName: `${session.client.firstName} ${session.client.lastName}`,
      clientEmail: session.client.email,
      projectId: session.projectId,
      projectTitle: session.project?.title ?? null,
      label: `Séance de tatouage du ${formatDate(session.startAt)}`,
      description: [session.project?.title, formatDuration(minutes)]
        .filter(Boolean)
        .join(" · "),
      amount,
      explanation,
      date: session.startAt.toISOString(),
      appointmentId: session.id,
    });
  }

  /* ── 3. Soldes de projet ── */
  for (const project of projects) {
    const ledger = ledgers.get(project.id);
    if (!ledger || ledger.agreed === null) continue;

    const remaining = ledger.agreed - ledger.invoiced;
    const started =
      ledger.doneSessions > 0 || ["done", "healing", "touchup"].includes(project.status);
    // Avant la première séance, c'est l'acompte qu'on facture, pas le solde.
    if (remaining <= 0 || (!started && kindFilter !== "balance")) continue;

    suggestions.push({
      key: `balance:${project.id}`,
      kind: "balance",
      invoiceKind: "balance",
      clientId: project.clientId,
      clientName: `${project.client.firstName} ${project.client.lastName}`,
      clientEmail: project.client.email,
      projectId: project.id,
      projectTitle: project.title,
      label: `Solde du projet « ${project.title} »`,
      description: ledger.quoteNumber
        ? `Devis ${ledger.quoteNumber} : ${formatCHF(ledger.agreed)}, déjà facturé ${formatCHF(ledger.invoiced)}`
        : `Prix convenu ${formatCHF(ledger.agreed)}, déjà facturé ${formatCHF(ledger.invoiced)}`,
      amount: remaining,
      explanation: `${formatCHF(ledger.agreed)} convenus − ${formatCHF(ledger.invoiced)} déjà facturés`,
      date: project.updatedAt.toISOString(),
    });
  }

  /* ── 4. Devis libres ── */
  if (!filter.projectId) {
    for (const quote of freeQuotes) {
      const valid = quote.invoices.filter(
        (invoice) => invoice.status !== "cancelled" && invoice.kind !== "credit_note",
      );
      const invoiced = valid.reduce((sum, invoice) => sum + invoice.total, 0);
      const depositBilled = valid.some((invoice) => invoice.kind === "deposit");
      const remaining = quote.total - invoiced;
      // Tant que l'acompte attendu n'est pas facturé, c'est lui qu'on propose.
      if (remaining <= 0 || (quote.depositAmount > 0 && !depositBilled)) continue;

      suggestions.push({
        key: `quote:${quote.id}`,
        kind: "quote",
        invoiceKind: invoiced > 0 ? "balance" : "full",
        clientId: quote.clientId,
        clientName: `${quote.client.firstName} ${quote.client.lastName}`,
        clientEmail: quote.client.email,
        projectId: null,
        projectTitle: null,
        label: invoiced > 0 ? `Solde du devis ${quote.number}` : quote.items[0]?.label ?? `Devis ${quote.number}`,
        description: invoiced > 0 ? `Devis de ${formatCHF(quote.total)}, acompte déduit` : `Devis ${quote.number}`,
        amount: remaining,
        explanation:
          invoiced > 0
            ? `${formatCHF(quote.total)} − ${formatCHF(invoiced)} déjà facturés`
            : `Montant du devis accepté le ${formatDate(quote.acceptedAt ?? quote.issuedAt)}`,
        date: (quote.acceptedAt ?? quote.issuedAt).toISOString(),
        quoteId: quote.id,
      });
    }
  }

  return suggestions.sort((a, b) => b.date.localeCompare(a.date));
}

/* ═══════════════════════════ Devis automatique ═══════════════════════════ */

export interface QuoteProposal {
  projectId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  projectTitle: string;
  label: string;
  description: string;
  sessions: number;
  hoursPerSession: number;
  /** Prix déjà fixé sur le projet, s'il existe (prioritaire sur le calcul) */
  presetPrice: number | null;
  hasAcceptedQuote: boolean;
}

/** Détails lisibles d'un projet pour la ligne de devis. */
export function describeProject(project: {
  style: string | null;
  bodyZone: string | null;
  widthCm: number | null;
  heightCm: number | null;
  colorMode: string;
}): string {
  const parts = [
    project.style ? `Style ${labelOf(PROJECT_STYLE, project.style).toLowerCase()}` : null,
    project.bodyZone ? labelOf(ALL_BODY_ZONES, project.bodyZone).toLowerCase() : null,
    project.widthCm && project.heightCm ? `${project.widthCm} × ${project.heightCm} cm` : null,
    labelOf(COLOR_MODE, project.colorMode).toLowerCase(),
  ].filter(Boolean);
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Projets pour lesquels un devis a du sens, préremplis. */
export async function getQuoteProposals(filter: {
  clientId?: string;
  projectId?: string;
}): Promise<QuoteProposal[]> {
  const projects = await db.project.findMany({
    where: {
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
      ...(filter.projectId
        ? { id: filter.projectId }
        : { status: { in: ["idea", "quoted", "accepted", "in_progress"] } }),
    },
    include: {
      client: true,
      quotes: { where: { status: "accepted" }, select: { id: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return projects.map((project) => {
    const sessions = Math.max(project.estimatedSessions, 1);
    // Durée prévue du projet, si elle a été renseignée ; sinon 3 h par séance.
    const hoursPerSession = project.estimatedMinutes
      ? Math.max(0.5, Math.round((project.estimatedMinutes / sessions / 60) * 2) / 2)
      : 3;

    return {
      projectId: project.id,
      clientId: project.clientId,
      clientName: `${project.client.firstName} ${project.client.lastName}`,
      clientEmail: project.client.email,
      projectTitle: project.title,
      label: project.title,
      description: describeProject(project),
      sessions,
      hoursPerSession,
      presetPrice: project.estimatedPrice,
      hasAcceptedQuote: project.quotes.length > 0,
    };
  });
}
