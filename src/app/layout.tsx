import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/misc";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InkFlow — Gestion de salon de tatouage",
    template: "%s · InkFlow",
  },
  description:
    "Clients, projets, rendez-vous, devis et factures en CHF avec QR-facture suisse.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Applique le thème avant le premier rendu pour éviter le flash de couleur.
 * Le dark mode est le défaut : ambiance salon.
 */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('inkflow-theme');
    var theme = stored || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        <Toaster
          position="bottom-right"
          closeButton
          richColors={false}
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              color: "var(--fg)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
