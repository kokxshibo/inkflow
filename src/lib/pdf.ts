import "server-only";
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Client, Settings } from "@prisma/client";
import { formatCHF, formatIban } from "./money";
import { formatDate, fullName } from "./utils";

interface DocumentItem {
  label: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
}

export interface DocumentPayload {
  kind: "quote" | "invoice";
  number: string;
  issuedAt: Date;
  secondDate: Date;
  client: Client;
  items: DocumentItem[];
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid?: number;
  depositAmount?: number;
  qrReference?: string | null;
  notes?: string | null;
  terms?: string | null;
}

const MARGIN = 56;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = "#18181b";
const MUTED = "#71717a";
const LIGHT = "#d4d4d8";
const ACCENT = "#b45309";

/**
 * Découpe « Rue du Rhône 12 » en { street: "Rue du Rhône", number: "12" }.
 * La QR-facture attend la rue et le numéro séparément.
 */
function splitAddress(line: string | null | undefined) {
  if (!line) return { street: "", buildingNumber: undefined as string | undefined };
  const match = line.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)$/);
  if (match) return { street: match[1].trim(), buildingNumber: match[2] };
  return { street: line.trim(), buildingNumber: undefined };
}

/** Génère le PDF complet (document + QR-facture pour les factures). */
export async function generateDocumentPdf(
  payload: DocumentPayload,
  settings: Settings,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `${payload.kind === "quote" ? "Devis" : "Facture"} ${payload.number}`,
      Author: settings.studioName,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawBody(doc, payload, settings);

  // QR-facture : uniquement sur les factures, et seulement si un IBAN est configuré.
  const iban = settings.qrIban || settings.iban;
  if (payload.kind === "invoice" && iban) {
    try {
      attachQrBill(doc, payload, settings, iban);
    } catch (error) {
      // Une QR-facture invalide ne doit pas empêcher la sortie du document.
      console.error("QR-facture non générée :", error);
      doc
        .fontSize(8)
        .fillColor("#b91c1c")
        .text(
          "QR-facture non générée : vérifie l'IBAN, l'adresse du salon et celle du client dans les réglages.",
          MARGIN,
          doc.page.height - MARGIN - 20,
          { width: CONTENT_WIDTH },
        );
    }
  }

  doc.end();
  return finished;
}

/* ─────────────────────────── Corps du document ─────────────────────────── */

function drawBody(
  doc: PDFKit.PDFDocument,
  payload: DocumentPayload,
  settings: Settings,
) {
  const isQuote = payload.kind === "quote";

  // ── En-tête ──
  doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text(settings.studioName, MARGIN, MARGIN);

  let y = doc.y + 4;
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED);

  const senderLines = [
    settings.ownerName,
    settings.addressLine,
    [settings.postalCode, settings.city].filter(Boolean).join(" "),
    settings.email,
    settings.phone,
  ].filter((line): line is string => Boolean(line));

  for (const line of senderLines) {
    doc.text(line, MARGIN, y, { width: 240 });
    y = doc.y;
  }

  if (settings.ide) {
    doc.text(`${settings.ide}${settings.vatEnabled ? " TVA" : ""}`, MARGIN, y + 3);
  }

  // ── Bloc titre (à droite) ──
  const rightX = PAGE_WIDTH - MARGIN - 190;
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .font("Helvetica")
    .text(isQuote ? "DEVIS" : "FACTURE", rightX, MARGIN, { width: 190, align: "right" });

  doc
    .fontSize(18)
    .fillColor(INK)
    .font("Helvetica-Bold")
    .text(payload.number, rightX, MARGIN + 11, { width: 190, align: "right" });

  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED);
  doc.text(`Date : ${formatDate(payload.issuedAt)}`, rightX, MARGIN + 36, {
    width: 190,
    align: "right",
  });
  doc.text(
    `${isQuote ? "Valable jusqu'au" : "Échéance"} : ${formatDate(payload.secondDate)}`,
    rightX,
    doc.y,
    { width: 190, align: "right" },
  );

  // ── Destinataire ──
  let cursor = Math.max(y + 34, MARGIN + 100);
  doc
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(isQuote ? "ÉTABLI POUR" : "FACTURÉ À", MARGIN, cursor);

  cursor = doc.y + 3;
  doc.fontSize(10).font("Helvetica-Bold").fillColor(INK).text(fullName(payload.client), MARGIN, cursor);

  cursor = doc.y + 1;
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED);
  const recipientLines = [
    payload.client.addressLine,
    [payload.client.postalCode, payload.client.city].filter(Boolean).join(" "),
  ].filter((line): line is string => Boolean(line));

  for (const line of recipientLines) {
    doc.text(line, MARGIN, cursor);
    cursor = doc.y;
  }

  // ── Tableau des prestations ──
  let tableY = cursor + 28;
  const columns = {
    label: MARGIN,
    quantity: MARGIN + 300,
    unitPrice: MARGIN + 350,
    total: MARGIN + 430,
  };
  const totalWidth = CONTENT_WIDTH;

  doc
    .moveTo(MARGIN, tableY)
    .lineTo(MARGIN + totalWidth, tableY)
    .lineWidth(0.5)
    .strokeColor(LIGHT)
    .stroke();

  tableY += 7;
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(MUTED);
  doc.text("DÉSIGNATION", columns.label, tableY);
  doc.text("QTÉ", columns.quantity, tableY, { width: 40, align: "center" });
  doc.text("PRIX UNIT.", columns.unitPrice, tableY, { width: 70, align: "right" });
  doc.text("TOTAL", columns.total, tableY, { width: 53, align: "right" });

  tableY += 14;
  doc
    .moveTo(MARGIN, tableY)
    .lineTo(MARGIN + totalWidth, tableY)
    .stroke();
  tableY += 8;

  doc.font("Helvetica").fontSize(9);

  for (const item of payload.items) {
    // Saut de page si nécessaire (on garde de la place pour la QR-facture)
    if (tableY > 600) {
      doc.addPage();
      tableY = MARGIN;
    }

    const lineTotal = Math.round(item.quantity * item.unitPrice);

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
    doc.text(item.label, columns.label, tableY, { width: 290 });
    let rowBottom = doc.y;

    if (item.description) {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(item.description, columns.label, rowBottom + 1, { width: 290 });
      rowBottom = doc.y;
    }

    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    doc.text(String(item.quantity), columns.quantity, tableY, {
      width: 40,
      align: "center",
    });
    doc.text(formatCHF(item.unitPrice, { showCurrency: false }), columns.unitPrice, tableY, {
      width: 70,
      align: "right",
    });
    doc.font("Helvetica-Bold").fillColor(INK);
    doc.text(formatCHF(lineTotal, { showCurrency: false }), columns.total, tableY, {
      width: 53,
      align: "right",
    });

    tableY = Math.max(rowBottom, doc.y) + 9;
    doc
      .moveTo(MARGIN, tableY - 4)
      .lineTo(MARGIN + totalWidth, tableY - 4)
      .lineWidth(0.5)
      .strokeColor("#f4f4f5")
      .stroke();
  }

  // ── Totaux ──
  let totalsY = tableY + 8;
  const labelX = MARGIN + 300;
  const valueX = MARGIN + 400;
  const valueWidth = 83;

  function totalRow(label: string, value: string, options: { bold?: boolean; color?: string } = {}) {
    doc
      .font(options.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(options.bold ? 11 : 9)
      .fillColor(options.color ?? (options.bold ? INK : MUTED));
    doc.text(label, labelX, totalsY, { width: 95, align: "right" });
    doc.text(value, valueX, totalsY, { width: valueWidth, align: "right" });
    totalsY += options.bold ? 17 : 14;
  }

  totalRow("Sous-total", formatCHF(payload.subtotal));
  if (payload.discount > 0) totalRow("Remise", `− ${formatCHF(payload.discount)}`);

  if (payload.vatRate > 0) {
    totalRow(`TVA ${payload.vatRate} %`, formatCHF(payload.vatAmount));
  }

  doc
    .moveTo(labelX, totalsY)
    .lineTo(MARGIN + totalWidth, totalsY)
    .lineWidth(0.7)
    .strokeColor(LIGHT)
    .stroke();
  totalsY += 7;

  totalRow("Total", formatCHF(payload.total), { bold: true });

  if (payload.vatRate === 0) {
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text("Non assujetti à la TVA au sens de la LTVA.", labelX, totalsY, {
      width: 183,
      align: "right",
    });
    totalsY = doc.y + 4;
  }

  if (isQuote && payload.depositAmount && payload.depositAmount > 0) {
    totalRow("Acompte à verser", formatCHF(payload.depositAmount), { color: ACCENT });
  }

  if (!isQuote && payload.amountPaid && payload.amountPaid > 0) {
    totalRow("Déjà reçu", `− ${formatCHF(payload.amountPaid)}`);
    totalRow("Reste à payer", formatCHF(payload.total - payload.amountPaid), {
      bold: true,
    });
  }

  // ── Notes, conditions, coordonnées ──
  let footerY = Math.max(totalsY + 22, tableY + 30);

  if (payload.notes) {
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(MUTED).text("NOTE", MARGIN, footerY);
    doc.fontSize(8.5).font("Helvetica").fillColor(INK);
    doc.text(payload.notes, MARGIN, doc.y + 2, { width: 340 });
    footerY = doc.y + 10;
  }

  if (payload.terms) {
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(MUTED).text("CONDITIONS", MARGIN, footerY);
    doc.fontSize(8.5).font("Helvetica").fillColor(INK);
    doc.text(payload.terms, MARGIN, doc.y + 2, { width: 340 });
    footerY = doc.y + 10;
  }

  if (!isQuote) {
    const iban = settings.qrIban || settings.iban;
    if (iban) {
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(MUTED).text("PAIEMENT", MARGIN, footerY);
      doc.fontSize(8.5).font("Helvetica").fillColor(INK);
      doc.text(
        `Par virement sur ${formatIban(iban)}${settings.bankName ? ` — ${settings.bankName}` : ""}, ou via la QR-facture ci-dessous.`,
        MARGIN,
        doc.y + 2,
        { width: 340 },
      );
    }
  }
}

/* ──────────────────────────── QR-facture suisse ──────────────────────────── */

function attachQrBill(
  doc: PDFKit.PDFDocument,
  payload: DocumentPayload,
  settings: Settings,
  iban: string,
) {
  const creditorAddress = splitAddress(settings.addressLine);
  const debtorAddress = splitAddress(payload.client.addressLine);

  const amountDue = payload.total - (payload.amountPaid ?? 0);

  const data: ConstructorParameters<typeof SwissQRBill>[0] = {
    amount: amountDue > 0 ? amountDue / 100 : undefined,
    currency: "CHF",
    creditor: {
      account: iban.replace(/\s/g, ""),
      address: creditorAddress.street,
      buildingNumber: creditorAddress.buildingNumber,
      city: settings.city,
      country: settings.country || "CH",
      name: settings.studioName,
      zip: settings.postalCode,
    },
    // La référence QRR n'est valable qu'avec un QR-IBAN.
    ...(settings.qrIban && payload.qrReference
      ? { reference: payload.qrReference }
      : {}),
    // Le débiteur n'est ajouté que si l'adresse est complète, sinon la
    // QR-facture est rejetée à la validation.
    ...(payload.client.addressLine && payload.client.postalCode && payload.client.city
      ? {
          debtor: {
            address: debtorAddress.street,
            buildingNumber: debtorAddress.buildingNumber,
            city: payload.client.city,
            country: payload.client.country || "CH",
            name: fullName(payload.client),
            zip: payload.client.postalCode,
          },
        }
      : {}),
    message: `${payload.number}`,
  };

  const qrBill = new SwissQRBill(data, { language: "FR" });
  qrBill.attachTo(doc);
}
