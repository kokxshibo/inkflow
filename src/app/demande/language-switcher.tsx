import Link from "next/link";
import { cn } from "@/lib/utils";
import { LANGUAGES, LANGUAGE_NAMES, type Lang } from "./i18n";

/**
 * Drapeaux dessinés en SVG : les émojis drapeaux ne s'affichent pas sous
 * Windows (on y verrait « FR », « DE », « GB »).
 */
function Flag({ lang }: { lang: Lang }) {
  const common = "block h-3.5 w-5 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.15)] shrink-0";
  if (lang === "fr") {
    return (
      <svg viewBox="0 0 3 2" className={common} aria-hidden>
        <rect width="1" height="2" fill="#0055A4" />
        <rect x="1" width="1" height="2" fill="#FFFFFF" />
        <rect x="2" width="1" height="2" fill="#EF4135" />
      </svg>
    );
  }
  if (lang === "de") {
    return (
      <svg viewBox="0 0 5 3" className={common} aria-hidden>
        <rect width="5" height="1" fill="#000000" />
        <rect y="1" width="5" height="1" fill="#DD0000" />
        <rect y="2" width="5" height="1" fill="#FFCE00" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" className={common} aria-hidden preserveAspectRatio="none">
      <clipPath id="flag-uk-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#flag-uk-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-uk-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

/** Choix de la langue du formulaire, en haut à droite (le lien perso est conservé). */
export function LanguageSwitcher({
  current,
  refToken,
  label,
}: {
  current: Lang;
  refToken?: string;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--surface)]/80 border border-[var(--border)] backdrop-blur"
    >
      {LANGUAGES.map((lang) => {
        const params = new URLSearchParams();
        if (lang !== "fr") params.set("lang", lang);
        if (refToken) params.set("ref", refToken);
        const query = params.toString();
        const active = lang === current;
        return (
          <Link
            key={lang}
            href={`/demande${query ? `?${query}` : ""}`}
            hrefLang={lang}
            lang={lang}
            aria-current={active ? "true" : undefined}
            title={LANGUAGE_NAMES[lang]}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-semibold uppercase tracking-wide transition-colors",
              active
                ? "bg-[var(--accent-soft)] text-[var(--fg)] ring-1 ring-[var(--accent)]/40"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
            )}
          >
            <Flag lang={lang} />
            <span>{lang}</span>
          </Link>
        );
      })}
    </nav>
  );
}
