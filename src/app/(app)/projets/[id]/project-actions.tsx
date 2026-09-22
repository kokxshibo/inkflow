"use client";

import * as React from "react";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CalendarDays,
  FileText,
  ReceiptText,
  CheckCircle2,
} from "lucide-react";
import { deleteProject, setProjectStatus } from "../actions";
import { PROJECT_STATUS } from "@/lib/constants";
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

export function ProjectActions({ project }: { project: Project }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function changeStatus(status: string) {
    startTransition(async () => {
      await setProjectStatus(project.id, status);
      const label = PROJECT_STATUS.find((s) => s.value === status)?.label ?? status;
      toast.success(`Statut mis à jour : ${label}`);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
          <Link href={`/devis/nouveau?client=${project.clientId}&projet=${project.id}`}>
            <FileText />
            Devis
          </Link>
        </Button>

        <Button asChild variant="primary" size="sm">
          <Link href={`/projets/${project.id}/modifier`}>
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
          <DropdownContent className="min-w-[220px]">
            <DropdownLabel>Changer le statut</DropdownLabel>
            {PROJECT_STATUS.map((status) => (
              <DropdownItem
                key={status.value}
                onSelect={() => changeStatus(status.value)}
                disabled={pending || project.status === status.value}
              >
                {project.status === status.value ? (
                  <CheckCircle2 className="text-[var(--accent)]" />
                ) : (
                  <span className="size-4" />
                )}
                {status.label}
              </DropdownItem>
            ))}

            <DropdownSeparator />
            <DropdownLabel>Créer</DropdownLabel>
            <DropdownItem asChild>
              <Link
                href={`/agenda?nouveau=1&client=${project.clientId}&projet=${project.id}`}
              >
                <CalendarDays /> Séance
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link href={`/devis/nouveau?client=${project.clientId}&projet=${project.id}`}>
                <FileText /> Devis
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link
                href={`/factures/nouvelle?client=${project.clientId}&projet=${project.id}`}
              >
                <ReceiptText /> Facture
              </Link>
            </DropdownItem>

            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Supprimer le projet
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer « ${project.title} » ?`}
        description="Les images et les rendez-vous liés seront supprimés. Les devis et factures resteront rattachés au client."
        confirmLabel="Supprimer"
        destructive
        loading={pending}
        onConfirm={() => startTransition(async () => void (await deleteProject(project.id)))}
      />
    </>
  );
}
