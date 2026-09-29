import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, getSettings } from "@/lib/db";
import { isDatabaseReady } from "@/lib/health";
import { REF_COOKIE, firstNameOf } from "@/lib/leads";
import { dictionary, formTexts, parseLang } from "./i18n";
import { LanguageSwitcher } from "./language-switcher";
import { RequestForm, type RequestPrefill } from "./request-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ref?: string; lang?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const t = dictionary(parseLang((await searchParams).lang));
  const name = (await isDatabaseReady()) ? (await getSettings()).studioName : "InkFlow";
  return {
    title: t.metaTitle(name),
    description: t.metaDescription(name),
    robots: { index: true, follow: true },
  };
}

export default async function PublicRequestPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isDatabaseReady())) redirect("/installation");

  const params = await searchParams;
  // Français par défaut ; allemand et anglais au choix, en haut à droite.
  const lang = parseLang(params.lang);
  const t = dictionary(lang);
  const settings = await getSettings();

  // Lien perso (/d/<jeton>) : on sait déjà qui écrit et depuis où.
  const token = params.ref ?? (await cookies()).get(REF_COOKIE)?.value;
  const lead =
    token && /^[a-z0-9]{6,32}$/.test(token)
      ? await db.lead.findUnique({ where: { token } })
      : null;

  const prefill: RequestPrefill = {};
  if (lead) {
    const firstName = firstNameOf(lead.name);
    prefill.firstName = firstName || undefined;
    // Le reste du nom affiché, s'il ressemble à un nom (pas d'emoji ni de pseudo).
    const rest = lead.name?.trim().split(/\s+/).slice(1).join(" ") ?? "";
    prefill.lastName = firstName && /^[\p{L}' -]+$/u.test(rest) ? rest : undefined;
    prefill.email = lead.email ?? undefined;
    prefill.instagram = lead.username ?? undefined;
  }

  // Seuls des textes simples passent au composant client.
  const texts = formTexts(lang, settings.studioName);

  return (
    <div lang={lang} className="min-h-dvh bg-[var(--bg)]">
      {/* Bandeau */}
      <header className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="absolute inset-0 grid-bg opacity-30" aria-hidden />
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full blur-[130px] opacity-[0.1]"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        <div className="relative max-w-2xl mx-auto px-6 pt-5 flex justify-end">
          <LanguageSwitcher current={lang} refToken={lead?.token} label={t.language} />
        </div>
        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-14 sm:pt-10 sm:pb-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            {settings.studioName}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-tight">
            {t.title}
          </h1>
          <p className="mt-4 text-[15px] text-[var(--fg-muted)] leading-relaxed max-w-lg mx-auto">
            {lead ? t.greeting(prefill.firstName, lead.channel === "instagram") : t.intro}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 sm:py-14">
        {/* La clé force un nouveau formulaire quand la langue change. */}
        <RequestForm
          key={lang}
          lang={lang}
          texts={texts}
          refToken={lead?.token}
          prefill={prefill}
        />
      </main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-[12px] text-[var(--fg-subtle)] leading-relaxed">
            {settings.studioName}
            {settings.addressLine && ` · ${settings.addressLine}`}
            {settings.city && `, ${settings.postalCode} ${settings.city}`}
          </p>
          <p className="text-[11px] text-[var(--fg-subtle)] mt-2 leading-relaxed">
            {t.privacy(settings.email || null)}
          </p>
        </div>
      </footer>
    </div>
  );
}
