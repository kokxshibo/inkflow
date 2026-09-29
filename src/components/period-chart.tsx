"use client";

import * as React from "react";
import { formatCHF } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface ChartSeries {
  name: string;
  /** Variable CSS de la couleur (catégorielle, validée en clair et en sombre) */
  color: string;
  /** Montants en centimes, un par colonne */
  values: number[];
}

/** Pas « rond » (1, 2, 5 × 10ⁿ francs) pour environ trois graduations. */
function niceStep(maxCents: number) {
  const francs = Math.max(maxCents / 100, 1) / 3;
  const power = 10 ** Math.floor(Math.log10(francs));
  const step = [1, 2, 5, 10].find((factor) => factor * power >= francs) ?? 10;
  return step * power * 100;
}

const tick = (cents: number) =>
  new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 })
    .format(cents / 100)
    .replace(/[‘’ʼ]/g, "'");

/**
 * Colonnes de suivi par période : une colonne par jour, semaine, mois ou année.
 * Au survol ou au clavier, une info-bulle donne le détail de la colonne.
 */
export function PeriodChart({
  title,
  buckets,
  series,
}: {
  title: string;
  buckets: { label: string; title: string }[];
  series: ChartSeries[];
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const max = Math.max(0, ...series.flatMap((serie) => serie.values));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const totals = series.map((serie) => serie.values.reduce((sum, value) => sum + value, 0));
  const dense = buckets.length > 16;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 mb-4">
        <span className="text-[13px] font-semibold text-[var(--fg)]">{title}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-hidden>
            {series.map((serie, index) => (
              <span key={serie.name} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
                <span className="size-2.5 rounded-[2px]" style={{ background: serie.color }} />
                {serie.name}
                <span className="text-[var(--fg)] font-medium tabular">{formatCHF(totals[index])}</span>
              </span>
            ))}
          </span>
        )}
      </figcaption>

      <div className="flex gap-2">
        {/* Graduations */}
        <div className="relative h-44 w-12 shrink-0 text-[10px] text-[var(--fg-subtle)] tabular" aria-hidden>
          {ticks.map((value) => (
            <span
              key={value}
              className="absolute right-0 -translate-y-1/2 leading-none"
              style={{ bottom: `${(value / top) * 100}%` }}
            >
              {tick(value)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="relative h-44">
            {ticks.map((value) => (
              <span
                key={value}
                className="absolute inset-x-0 h-px bg-[var(--border)]"
                style={{ bottom: `${(value / top) * 100}%` }}
                aria-hidden
              />
            ))}

            {max === 0 && (
              <p className="absolute inset-0 grid place-items-center text-[12px] text-[var(--fg-subtle)]">
                Aucun montant sur cette période
              </p>
            )}

            <div className="absolute inset-0 flex items-stretch">
              {buckets.map((bucket, index) => {
                const summary = `${bucket.title} : ${series
                  .map((serie) => `${serie.name} ${formatCHF(serie.values[index])}`)
                  .join(", ")}`;
                return (
                  <div
                    key={bucket.title}
                    role="img"
                    tabIndex={0}
                    aria-label={summary}
                    onPointerEnter={() => setActive(index)}
                    onPointerLeave={() => setActive((current) => (current === index ? null : current))}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="relative flex-1 min-w-0 flex items-end justify-center gap-[2px] px-[3px] outline-none rounded-[var(--radius-xs)] focus-visible:bg-[var(--surface-2)]"
                  >
                    {series.map((serie) => {
                      const value = serie.values[index];
                      return (
                        <span
                          key={serie.name}
                          className={cn(
                            "block flex-1 max-w-6 min-w-[3px] rounded-t-[4px] transition-[filter] duration-150",
                            active === index && "brightness-125",
                          )}
                          style={{
                            height: value > 0 ? `max(2px, ${(value / top) * 100}%)` : 0,
                            background: serie.color,
                          }}
                        />
                      );
                    })}

                    {active === index && (
                      <span
                        role="tooltip"
                        className={cn(
                          "absolute bottom-full mb-2 z-20 pointer-events-none",
                          "min-w-40 px-3 py-2 rounded-[var(--radius-sm)] shadow-[var(--shadow-md)]",
                          "bg-[var(--surface)] border border-[var(--border)] text-left",
                          index < buckets.length / 2 ? "left-0" : "right-0",
                        )}
                      >
                        <span className="block text-[11px] text-[var(--fg-subtle)] mb-1 whitespace-nowrap">
                          {bucket.title}
                        </span>
                        {series.map((serie) => (
                          <span key={serie.name} className="flex items-center gap-2 whitespace-nowrap">
                            <span className="h-0.5 w-3 rounded-full" style={{ background: serie.color }} />
                            <span className="text-[13px] font-semibold text-[var(--fg)] tabular">
                              {formatCHF(serie.values[index])}
                            </span>
                            <span className="text-[11px] text-[var(--fg-muted)]">{serie.name}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Libellés des colonnes */}
          <div className="flex mt-1.5" aria-hidden>
            {buckets.map((bucket, index) => (
              <span
                key={bucket.title}
                className="flex-1 min-w-0 text-center text-[10px] text-[var(--fg-subtle)] truncate"
              >
                {dense && index % 2 === 1 ? "" : bucket.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Les mêmes chiffres en tableau, pour les lecteurs d'écran. */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            {series.map((serie) => (
              <th key={serie.name} scope="col">
                {serie.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket, index) => (
            <tr key={bucket.title}>
              <th scope="row">{bucket.title}</th>
              {series.map((serie) => (
                <td key={serie.name}>{formatCHF(serie.values[index])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
