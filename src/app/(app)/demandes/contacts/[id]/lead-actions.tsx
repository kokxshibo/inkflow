"use client";

import * as React from "react";
import { toast } from "sonner";
import { Instagram, MoreHorizontal, RefreshCw, Send, Trash2 } from "lucide-react";
import { deleteLead, refreshLeadProfileAction, sendLeadLink } from "../../actions";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dialog";

export function LeadActions({
  lead,
  instagramUrl,
}: {
  lead: { id: string; channel: string; linkSent: boolean };
  instagramUrl: string | null;
}) {
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  function send() {
    startTransition(async () => {
      const result = await sendLeadLink(lead.id);
      if (result.error) toast.error(result.error);
      else toast.success("Lien envoyé");
    });
  }

  function refresh() {
    startTransition(async () => {
      const result = await refreshLeadProfileAction(lead.id);
      if (result.error) toast.error(result.error);
      else toast.success("Profil actualisé");
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {instagramUrl && (
          <Button asChild variant="secondary" size="sm">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
              <Instagram />
              <span className="hidden sm:inline">Voir son profil</span>
            </a>
          </Button>
        )}
        <Button variant={lead.linkSent ? "secondary" : "primary"} size="sm" onClick={send} loading={pending}>
          <Send />
          {lead.linkSent ? "Renvoyer le lien" : "Envoyer le lien"}
        </Button>
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            {lead.channel === "instagram" && (
              <>
                <DropdownItem onSelect={refresh} disabled={pending}>
                  <RefreshCw /> Actualiser pseudo et photo
                </DropdownItem>
                <DropdownSeparator />
              </>
            )}
            <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Supprimer le contact
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer ce contact ?"
        description="La conversation enregistrée et son lien perso seront supprimés. Ses demandes éventuelles restent, sans provenance."
        confirmLabel="Supprimer"
        destructive
        loading={pending}
        onConfirm={() => startTransition(() => deleteLead(lead.id))}
      />
    </>
  );
}
