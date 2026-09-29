"use client";

import * as React from "react";
import Link from "next/link";
import type { ProjectRequest } from "@prisma/client";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Trash2,
  UserPlus,
  Eye,
  XCircle,
  Mail,
  ExternalLink,
  Instagram,
} from "lucide-react";
import { convertRequest, deleteRequest, setRequestStatus } from "../actions";
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

export function RequestActions({
  request,
  instagramUrl,
}: {
  request: ProjectRequest;
  /** Profil Instagram de la personne, s'il est connu. */
  instagramUrl?: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const converted = request.status === "converted";

  function run(fn: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "L'opération a échoué");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {converted && request.projectId ? (
          <Button asChild variant="primary" size="sm">
            <Link href={`/projets/${request.projectId}`}>
              <ExternalLink />
              Voir le projet
            </Link>
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() =>
              run(() => convertRequest(request.id), "Client et projet créés")
            }
          >
            <UserPlus />
            <span className="hidden sm:inline">Convertir en client</span>
            <span className="sm:hidden">Convertir</span>
          </Button>
        )}

        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Statut</DropdownLabel>
            <DropdownItem
              onSelect={() =>
                run(() => setRequestStatus(request.id, "reviewing"), "Marquée en examen")
              }
              disabled={pending}
            >
              <Eye /> En cours d&apos;examen
            </DropdownItem>
            <DropdownItem
              onSelect={() =>
                run(() => setRequestStatus(request.id, "declined"), "Demande déclinée")
              }
              disabled={pending}
            >
              <XCircle /> Décliner
            </DropdownItem>

            <DropdownSeparator />
            <DropdownItem asChild>
              <a href={`mailto:${request.email}`}>
                <Mail /> Répondre par e-mail
              </a>
            </DropdownItem>
            {instagramUrl && (
              <DropdownItem asChild>
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                  <Instagram /> Voir son profil Instagram
                </a>
              </DropdownItem>
            )}

            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Supprimer la demande
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer cette demande ?"
        description="Cette action est définitive. Si tu veux juste la masquer, décline-la plutôt."
        confirmLabel="Supprimer"
        destructive
        loading={pending}
        onConfirm={() => run(() => deleteRequest(request.id), "Demande supprimée")}
      />
    </>
  );
}
