"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Affiche l'URL publique complète et permet de la copier. */
export function CopyLink({ path }: { path: string }) {
  const [url, setUrl] = React.useState(path);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  function copy() {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Lien copié");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Impossible de copier le lien"),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="flex-1 min-w-0 px-3 h-10 flex items-center rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] border border-[var(--border)] text-[12px] text-[var(--fg-muted)] truncate tabular">
        {url}
      </code>
      <Button variant="secondary" size="md" onClick={copy}>
        {copied ? <Check className="text-[var(--success)]" /> : <Copy />}
        {copied ? "Copié" : "Copier"}
      </Button>
      <Button asChild variant="secondary" size="icon">
        <a href={path} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le formulaire">
          <ExternalLink />
        </a>
      </Button>
    </div>
  );
}
