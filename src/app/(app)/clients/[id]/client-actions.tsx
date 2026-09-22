"use client";

import * as React from "react";
import Link from "next/link";
import type { Client } from "@prisma/client";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  BadgeCheck,
  Download,
  Palette,
  CalendarDays,
  FileText,
  Mail,
  Ban,
  UserCheck,
} from "lucide-react";
import { deleteClient, verifyIdentity, exportClientData, setClientStatus } from "../actions";
import { fullName, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dialog";

export function ClientActions({ client }: { client: Client }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleVerify() {
    startTransition(async () => {
      await verifyIdentity(client.id);
      toast.success("Identité marquée comme vérifiée");
    });
  }

  function handleBlock() {
    const next = client.status === "blocked" ? "active" : "blocked";
    startTransition(async () => {
      await setClientStatus(client.id, next);
      toast.success(
        next === "blocked" ? "Client placé en liste rouge" : "Client réactivé",
      );
    });
  }

  function handleExport() {
    startTransition(async () => {
      try {
        const json = await exportClientData(client.id);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `donnees-${slugify(fullName(client))}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Données exportées", {
          description: "Fichier conforme au droit d'accès nLPD.",
        });
      } catch {
        toast.error("L'export a échoué");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteClient(client.id);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
          <Link href={`/projets/nouveau?client=${client.id}`}>
            <Palette />
            Projet
          </Link>
        </Button>

        <Button asChild variant="primary" size="sm">
          <Link href={`/clients/${client.id}/modifier`}>
            <Pencil />
            <span className="hidden sm:inline">Modifier</span>
          </Link>
        </Button>

        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Créer</DropdownLabel>
            <DropdownItem asChild>
              <Link href={`/projets/nouveau?client=${client.id}`}>
                <Palette /> Nouveau projet
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link href={`/agenda?nouveau=1&client=${client.id}`}>
                <CalendarDays /> Nouveau rendez-vous
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link href={`/devis/nouveau?client=${client.id}`}>
                <FileText /> Nouveau devis
              </Link>
            </DropdownItem>
            {client.email && (
              <DropdownItem asChild>
                <Link href={`/messagerie/nouveau?client=${client.id}`}>
                  <Mail /> Écrire un e-mail
                </Link>
              </DropdownItem>
            )}

            <DropdownSeparator />
            <DropdownLabel>Administration</DropdownLabel>

            {!client.identityVerifiedAt && (
              <DropdownItem onSelect={handleVerify} disabled={pending}>
                <BadgeCheck /> Marquer l&apos;identité vérifiée
              </DropdownItem>
            )}

            <DropdownItem onSelect={handleBlock} disabled={pending}>
              {client.status === "blocked" ? (
                <>
                  <UserCheck /> Retirer de la liste rouge
                </>
              ) : (
                <>
                  <Ban /> Placer en liste rouge
                </>
              )}
            </DropdownItem>

            <DropdownItem onSelect={handleExport} disabled={pending}>
              <Download /> Exporter ses données
            </DropdownItem>

            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Supprimer le client
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer ${fullName(client)} ?`}
        description={
          <>
            Cette action est définitive. Tous ses projets, rendez-vous, devis et factures
            seront supprimés.
            <br />
            <br />
            <strong className="text-[var(--warning)]">
              Attention : les factures doivent légalement être conservées 10 ans.
            </strong>{" "}
            Exporte ses données avant de continuer, ou place-le simplement en statut
            « Archivé ».
          </>
        }
        confirmLabel="Supprimer définitivement"
        destructive
        loading={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
