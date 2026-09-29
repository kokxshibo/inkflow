import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/misc";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InkFlow — Gestion pour tatoueur",
    template: "%s · InkFlow",
  },
  description:
    "Clients, projets, rendez-vous, devis et factures en CHF avec QR-facture suisse.",
  robots: { index: false, follow: false },
  applicationName: "InkFlow",
  appleWebApp: {
    capable: true,
    title: "InkFlow",
    // Le contenu passe sous la barre d'état : les encoches sont gérées en CSS.
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // Empêche iOS de transformer les numéros de facture en liens téléphone.
    telephone: false,
    date: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Indispensable sur iPhone : le contenu s'étend sous les encoches,
  // et env(safe-area-inset-*) devient exploitable.
  viewportFit: "cover",
};

/**
 * Applique le thème avant le premier rendu pour éviter le flash de couleur.
 * Le dark mode est le défaut : ambiance atelier.
 */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('inkflow-theme');
    document.documentElement.setAttribute('data-theme', stored || 'dark');
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
          position="top-center"
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
          // Sous l'encoche sur iPhone, en haut de l'écran ailleurs.
          offset="calc(env(safe-area-inset-top, 0px) + 12px)"
        />
      </body>
    </html>
  );
}
