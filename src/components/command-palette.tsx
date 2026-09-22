"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Users,
  Palette,
  CalendarDays,
  FileText,
  ReceiptText,
  Inbox,
  Sparkles,
  Settings,
  Plus,
  Search,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";

interface SearchResult {
  id: string;
  type: "client" | "project" | "quote" | "invoice";
  title: string;
  subtitle?: string;
  href: string;
}

const NAVIGATION = [
  { label: "Tableau de bord", href: "/tableau-de-bord", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Demandes reçues", href: "/demandes", icon: Sparkles },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Projets", href: "/projets", icon: Palette },
  { label: "Messagerie", href: "/messagerie", icon: Inbox },
  { label: "Devis", href: "/devis", icon: FileText },
  { label: "Factures", href: "/factures", icon: ReceiptText },
  { label: "Réglages", href: "/reglages", icon: Settings },
];

const ACTIONS = [
  { label: "Créer un client", href: "/clients/nouveau", icon: Users },
  { label: "Créer un projet", href: "/projets/nouveau", icon: Palette },
  { label: "Créer un rendez-vous", href: "/agenda?nouveau=1", icon: CalendarDays },
  { label: "Créer un devis", href: "/devis/nouveau", icon: FileText },
  { label: "Créer une facture", href: "/factures/nouvelle", icon: ReceiptText },
];

const TYPE_ICON = {
  client: Users,
  project: Palette,
  quote: FileText,
  invoice: ReceiptText,
} as const;

const TYPE_LABEL = {
  client: "Client",
  project: "Projet",
  quote: "Devis",
  invoice: "Facture",
} as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Recherche serveur avec anti-rebond
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/recherche?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (response.ok) setResults(await response.json());
      } catch {
        /* requête annulée ou réseau indisponible */
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setQuery("");
        setResults([]);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[15vh] z-[60] -translate-x-1/2",
            "w-[calc(100vw-2rem)] max-w-[600px]",
            "rounded-[var(--radius-xl)] border border-[var(--border-strong)]",
            "bg-[var(--surface)] shadow-[var(--shadow-lg)] overflow-hidden",
            "data-[state=open]:animate-scale-in",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Recherche globale</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Recherchez un client, un projet, un devis ou une facture.
          </DialogPrimitive.Description>

          <Command shouldFilter={false} loop className="outline-none">
            <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
              {loading ? (
                <Loader2 className="size-[18px] shrink-0 text-[var(--accent)] animate-spin" />
              ) : (
                <Search className="size-[18px] shrink-0 text-[var(--fg-subtle)]" />
              )}
              <Command.Input
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Rechercher un client, un projet, un devis…"
                className={cn(
                  "flex-1 bg-transparent outline-none text-[15px] text-[var(--fg)]",
                  "placeholder:text-[var(--fg-subtle)]",
                )}
              />
              <kbd className="hidden sm:inline-flex items-center h-5 px-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[10px] text-[var(--fg-subtle)]">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="py-10 text-center">
                <p className="text-[13px] text-[var(--fg-muted)]">
                  {query.trim().length < 2
                    ? "Tape au moins 2 caractères pour lancer la recherche."
                    : loading
                      ? "Recherche en cours…"
                      : `Aucun résultat pour « ${query} »`}
                </p>
              </Command.Empty>

              {results.length > 0 && (
                <Group heading="Résultats">
                  {results.map((result) => {
                    const Icon = TYPE_ICON[result.type];
                    return (
                      <Item key={`${result.type}-${result.id}`} onSelect={() => go(result.href)}>
                        {result.type === "client" ? (
                          <Avatar
                            size="xs"
                            initials={initials(
                              result.title.split(" ")[0],
                              result.title.split(" ")[1],
                            )}
                          />
                        ) : (
                          <Icon className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                        )}
                        <span className="truncate flex-1">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-[11px] text-[var(--fg-subtle)] truncate max-w-[40%]">
                            {result.subtitle}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-wide text-[var(--fg-subtle)] shrink-0">
                          {TYPE_LABEL[result.type]}
                        </span>
                      </Item>
                    );
                  })}
                </Group>
              )}

              {query.trim().length < 2 && (
                <>
                  <Group heading="Créer">
                    {ACTIONS.map((action) => (
                      <Item key={action.href} onSelect={() => go(action.href)}>
                        <span className="grid place-items-center size-5 rounded bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                          <Plus className="size-3" />
                        </span>
                        <span className="flex-1 truncate">{action.label}</span>
                      </Item>
                    ))}
                  </Group>

                  <Group heading="Naviguer">
                    {NAVIGATION.map((nav) => (
                      <Item key={nav.href} onSelect={() => go(nav.href)}>
                        <nav.icon className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                        <span className="flex-1 truncate">{nav.label}</span>
                      </Item>
                    ))}
                  </Group>
                </>
              )}
            </Command.List>

            <div className="flex items-center gap-4 px-4 h-10 border-t border-[var(--border)] bg-[var(--bg-subtle)]/60">
              <Hint keys={["↑", "↓"]} label="Naviguer" />
              <Hint keys={["↵"]} label="Ouvrir" icon={<CornerDownLeft className="size-2.5" />} />
              <span className="ml-auto text-[10px] text-[var(--fg-subtle)]">InkFlow</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className={cn(
        "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5",
        "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold",
        "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
        "[&_[cmdk-group-heading]]:text-[var(--fg-subtle)]",
        "mb-1",
      )}
    >
      {children}
    </Command.Group>
  );
}

function Item({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)]",
        "text-[13px] text-[var(--fg-muted)] cursor-pointer select-none",
        "transition-colors duration-150",
        "data-[selected=true]:bg-[var(--surface-2)] data-[selected=true]:text-[var(--fg)]",
      )}
    >
      {children}
    </Command.Item>
  );
}

function Hint({
  keys,
  label,
  icon,
}: {
  keys: string[];
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-[var(--fg-subtle)]">
      {keys.map((key) => (
        <kbd
          key={key}
          className="grid place-items-center min-w-[16px] h-4 px-1 rounded border border-[var(--border)] bg-[var(--surface-2)]"
        >
          {icon ?? key}
        </kbd>
      ))}
      {label}
    </span>
  );
}
