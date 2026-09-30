"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
  Search,
  Plus,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Wallet,
  HeartPulse,
  ScanLine,
  MoreHorizontal,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/misc";
import { CommandPalette } from "@/components/command-palette";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

export interface ShellCounts {
  requests: number;
  unreadMessages: number;
  todayAppointments: number;
  expensesToPay: number;
  obligationsDue: number;
}

export function AppShell({
  children,
  user,
  ownerName,
  counts,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  ownerName: string;
  counts: ShellCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("inkflow-sidebar") === "collapsed");
      setTheme(
        (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark",
      );
    } catch {
      /* stockage indisponible : on garde les valeurs par défaut */
    }
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "b") {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem("inkflow-sidebar", next ? "collapsed" : "expanded");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("inkflow-theme", next);
    } catch {
      /* ignore */
    }
  }

  const sections: NavSection[] = [
    {
      items: [
        { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
        { href: "/agenda", label: "Agenda", icon: CalendarDays, badge: counts.todayAppointments },
        { href: "/demandes", label: "Demandes", icon: Sparkles, badge: counts.requests },
      ],
    },
    {
      label: "Clientèle",
      items: [
        { href: "/clients", label: "Clients", icon: Users },
        { href: "/projets", label: "Projets", icon: Palette },
        { href: "/messagerie", label: "Messagerie", icon: Inbox, badge: counts.unreadMessages },
      ],
    },
    {
      label: "Finances",
      items: [
        { href: "/devis", label: "Devis", icon: FileText },
        { href: "/factures", label: "Factures", icon: ReceiptText },
        { href: "/depenses", label: "Dépenses", icon: Wallet, badge: counts.expensesToPay },
      ],
    },
    {
      label: "Personnel",
      items: [
        { href: "/perso", label: "AVS, santé, impôts", icon: HeartPulse, badge: counts.obligationsDue },
      ],
    },
  ];

  // Cinq onglets maximum en bas d'écran : au-delà, ça devient illisible au pouce.
  const tabs: NavItem[] = [
    { href: "/tableau-de-bord", label: "Accueil", icon: LayoutDashboard },
    { href: "/agenda", label: "Agenda", icon: CalendarDays, badge: counts.todayAppointments },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/factures", label: "Factures", icon: ReceiptText },
  ];

  const sidebarWidth = collapsed ? 68 : 248;

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* ─── Barre latérale (bureau) ─── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col",
          "border-r border-[var(--border)] bg-[var(--bg-subtle)]",
        )}
      >
        <SidebarBody
          sections={sections}
          pathname={pathname}
          collapsed={collapsed}
          ownerName={ownerName}
          user={user}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleCollapsed={toggleCollapsed}
          onLogout={() => router.push("/deconnexion")}
        />
      </motion.aside>

      {/* ─── Tiroir (mobile) ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] lg:hidden flex flex-col",
                "border-r border-[var(--border)] bg-[var(--bg-subtle)]",
                "safe-top safe-bottom",
              )}
            >
              <SidebarBody
                sections={sections}
                pathname={pathname}
                collapsed={false}
                ownerName={ownerName}
                user={user}
                theme={theme}
                onToggleTheme={toggleTheme}
                onClose={() => setMobileOpen(false)}
                onLogout={() => router.push("/deconnexion")}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Contenu ─── */}
      <div
        className="transition-[padding] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ paddingLeft: "var(--sidebar-pad, 0px)" }}
        data-sidebar={collapsed ? "collapsed" : "expanded"}
      >
        <style>{`@media (min-width: 1024px) { [data-sidebar] { --sidebar-pad: ${sidebarWidth}px; } }`}</style>

        {/* Barre supérieure */}
        <header
          className={cn(
            "sticky top-0 z-30 flex items-center gap-2 px-4 sm:px-6",
            "h-14 pt-[var(--safe-top)] box-content lg:box-border lg:pt-0",
            "border-b border-[var(--border)] glass",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden -ml-1"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu />
          </Button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={cn(
              "group flex items-center gap-2.5 h-9 px-3 flex-1 max-w-sm",
              "rounded-[var(--radius-sm)] border border-[var(--border)]",
              "bg-[var(--bg-subtle)] text-[13px] text-[var(--fg-subtle)]",
              "transition-all duration-200",
              "hover:border-[var(--border-strong)] hover:bg-[var(--surface)]",
            )}
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Rechercher…</span>
            <kbd
              className={cn(
                "ml-auto hidden sm:inline-flex items-center gap-0.5 h-5 px-1.5",
                "rounded border border-[var(--border)] bg-[var(--surface-2)]",
                "text-[10px] font-medium text-[var(--fg-subtle)]",
              )}
            >
              ⌘K
            </kbd>
          </button>

          <div className="flex-1" />

          {/* Raccourci scan : l'action la plus fréquente sur téléphone */}
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="sm:hidden"
            aria-label="Scanner une facture"
          >
            <Link href="/depenses/scanner">
              <ScanLine />
            </Link>
          </Button>

          <Dropdown>
            <DropdownTrigger asChild>
              <Button size="sm" variant="primary" className="gap-1.5">
                <Plus />
                <span className="hidden sm:inline">Créer</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>Créer</DropdownLabel>
              <DropdownItem onSelect={() => router.push("/clients/nouveau")}>
                <Users /> Nouveau client
              </DropdownItem>
              <DropdownItem onSelect={() => router.push("/projets/nouveau")}>
                <Palette /> Nouveau projet
              </DropdownItem>
              <DropdownItem onSelect={() => router.push("/agenda?nouveau=1")}>
                <CalendarDays /> Nouveau rendez-vous
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push("/devis/nouveau")}>
                <FileText /> Nouveau devis
              </DropdownItem>
              <DropdownItem onSelect={() => router.push("/factures/nouvelle")}>
                <ReceiptText /> Nouvelle facture
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push("/depenses/scanner")}>
                <ScanLine /> Scanner une facture fournisseur
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </header>

        <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-[1400px] mx-auto has-tabbar lg:pb-8">
          {children}
        </main>
      </div>

      {/* ─── Barre d'onglets (mobile) ─── */}
      <nav
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 lg:hidden tabbar-hide-on-keyboard",
          "border-t border-[var(--border)] glass",
          "pb-[var(--safe-bottom)]",
        )}
        aria-label="Navigation principale"
      >
        <ul className="grid grid-cols-5 h-[var(--tabbar-height)]">
          {tabs.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 h-full",
                    "text-[10px] font-medium transition-colors duration-200",
                    active ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-active"
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--accent)]"
                    />
                  )}
                  <span className="relative">
                    <tab.icon className="size-[21px]" />
                    {tab.badge ? (
                      <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-[var(--accent)] text-[9px] font-semibold text-[var(--accent-fg)] tabular">
                        {tab.badge > 9 ? "9+" : tab.badge}
                      </span>
                    ) : null}
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 h-full w-full",
                "text-[10px] font-medium text-[var(--fg-subtle)] transition-colors",
              )}
            >
              <span className="relative">
                <MoreHorizontal className="size-[21px]" />
                {counts.requests + counts.expensesToPay + counts.obligationsDue > 0 && (
                  <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-[var(--accent)]" />
                )}
              </span>
              Plus
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/* ──────────────────────── Corps de la barre latérale ──────────────────────── */

function SidebarBody({
  sections,
  pathname,
  collapsed,
  ownerName,
  user,
  theme,
  onToggleTheme,
  onToggleCollapsed,
  onClose,
  onLogout,
}: {
  sections: NavSection[];
  pathname: string;
  collapsed: boolean;
  ownerName: string;
  user: { name: string; email: string };
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onToggleCollapsed?: () => void;
  onClose?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "h-14 flex items-center gap-2.5 border-b border-[var(--border)] shrink-0",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link href="/tableau-de-bord" className="flex items-center gap-2.5 min-w-0 group">
          <span
            className={cn(
              "grid place-items-center size-8 shrink-0 rounded-[var(--radius-sm)]",
              "bg-[var(--accent)] text-[var(--accent-fg)]",
              "font-bold text-sm transition-transform duration-200 group-hover:scale-105",
            )}
          >
            IF
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[var(--fg)] truncate leading-tight">
                {ownerName}
              </span>
              <span className="block text-[10px] text-[var(--fg-subtle)] uppercase tracking-wider">
                InkFlow
              </span>
            </span>
          )}
        </Link>
        {onClose && (
          <Button variant="ghost" size="iconSm" className="ml-auto" onClick={onClose}>
            <X />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
        {sections.map((section, index) => (
          <div key={index} className="space-y-0.5">
            {section.label && !collapsed && (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative group flex items-center gap-2.5 h-10 rounded-[var(--radius-sm)]",
                    "text-[13px] font-medium transition-colors duration-200",
                    collapsed ? "justify-center px-0" : "px-2.5",
                    active
                      ? "text-[var(--fg)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] border border-[var(--accent)]/20"
                    />
                  )}
                  <item.icon
                    className={cn(
                      "relative size-[17px] shrink-0 transition-colors",
                      active && "text-[var(--accent)]",
                    )}
                  />
                  {!collapsed && <span className="relative truncate">{item.label}</span>}
                  {item.badge ? (
                    collapsed ? (
                      <span className="absolute top-1.5 right-1.5 size-[7px] rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-subtle)]" />
                    ) : (
                      <span
                        className={cn(
                          "relative ml-auto min-w-[20px] h-5 px-1.5 grid place-items-center",
                          "rounded-full text-[10px] font-semibold tabular",
                          "bg-[var(--accent)] text-[var(--accent-fg)]",
                        )}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-2.5 space-y-0.5 shrink-0">
        <Link
          href="/reglages"
          title={collapsed ? "Réglages" : undefined}
          className={cn(
            "flex items-center gap-2.5 h-10 rounded-[var(--radius-sm)]",
            "text-[13px] font-medium text-[var(--fg-muted)]",
            "transition-colors duration-200 hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          <Settings className="size-[17px] shrink-0" />
          {!collapsed && <span>Réglages</span>}
        </Link>

        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Passer en clair" : "Passer en sombre"}
            className={cn(
              "flex items-center justify-center size-10 rounded-[var(--radius-sm)]",
              "text-[var(--fg-muted)] transition-colors duration-200",
              "hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
            )}
          >
            {theme === "dark" ? <Moon className="size-[17px]" /> : <Sun className="size-[17px]" />}
          </button>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="Réduire le menu (⌘B)"
              className={cn(
                "flex items-center justify-center size-10 rounded-[var(--radius-sm)]",
                "text-[var(--fg-muted)] transition-colors duration-200",
                "hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
              )}
            >
              {collapsed ? (
                <PanelLeft className="size-[17px]" />
              ) : (
                <PanelLeftClose className="size-[17px]" />
              )}
            </button>
          )}
        </div>

        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2.5 p-1.5 rounded-[var(--radius-sm)]",
                "transition-colors duration-200 hover:bg-[var(--surface-2)]",
                collapsed && "justify-center",
              )}
            >
              <Avatar
                initials={initials(user.name.split(" ")[0], user.name.split(" ")[1])}
                size="sm"
              />
              {!collapsed && (
                <span className="min-w-0 text-left">
                  <span className="block text-[13px] font-medium text-[var(--fg)] truncate leading-tight">
                    {user.name}
                  </span>
                  <span className="block text-[11px] text-[var(--fg-subtle)] truncate">
                    {user.email}
                  </span>
                </span>
              )}
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" side="top">
            <DropdownLabel>{user.email}</DropdownLabel>
            <DropdownItem asChild>
              <Link href="/reglages">
                <Settings /> Réglages
              </Link>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onSelect={onLogout}>
              <LogOut /> Se déconnecter
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </>
  );
}
