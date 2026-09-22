"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface Filter {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Barre de recherche + filtres synchronisés avec l'URL.
 * La recherche est débattue pour ne pas recharger à chaque frappe.
 */
export function ListToolbar({
  basePath,
  searchPlaceholder = "Rechercher…",
  filters = [],
  children,
}: {
  basePath: string;
  searchPlaceholder?: string;
  filters?: Filter[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = React.useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = React.useTransition();

  // Resynchronise si l'URL change depuis l'extérieur (retour navigateur)
  React.useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const pushParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  // Anti-rebond sur la saisie
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      pushParams((params) => {
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, pushParams, searchParams]);

  const activeFilters = filters.filter((filter) => searchParams.get(filter.param));
  const hasActive = activeFilters.length > 0 || Boolean(searchParams.get("q"));

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-5">
      <div className="relative flex-1 max-w-md">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={searchPlaceholder}
          icon={<Search />}
          className={cn("pr-9", isPending && "opacity-70")}
          aria-label="Rechercher"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-0 top-0 h-10 w-9 grid place-items-center text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
            aria-label="Effacer la recherche"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((filter) => {
          const current = searchParams.get(filter.param) ?? "";
          return (
            <div key={filter.param} className="relative">
              <select
                value={current}
                onChange={(event) =>
                  pushParams((params) => {
                    if (event.target.value) params.set(filter.param, event.target.value);
                    else params.delete(filter.param);
                  })
                }
                className={cn(
                  "h-10 pl-8 pr-8 appearance-none cursor-pointer text-[13px]",
                  "rounded-[var(--radius-sm)] border transition-colors duration-200",
                  "focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring)]",
                  "[&>option]:bg-[var(--surface)]",
                  current
                    ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                )}
                aria-label={filter.label}
              >
                <option value="">{filter.label}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none opacity-70" />
            </div>
          );
        })}

        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.replace(basePath, { scroll: false }))}
          >
            <X />
            Réinitialiser
          </Button>
        )}

        {children}
      </div>
    </div>
  );
}
