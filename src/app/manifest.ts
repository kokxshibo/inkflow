import type { MetadataRoute } from "next";

/**
 * Manifeste d'application installable.
 * Sur iPhone : Safari → Partager → « Sur l'écran d'accueil ».
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InkFlow — Gestion pour tatoueur",
    short_name: "InkFlow",
    description:
      "Clients, projets, rendez-vous, devis, factures en CHF et gestion personnelle.",
    start_url: "/tableau-de-bord",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#131316",
    theme_color: "#131316",
    lang: "fr-CH",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/agenda" },
      { name: "Nouveau client", url: "/clients/nouveau" },
      { name: "Scanner une facture", url: "/depenses/scanner" },
    ],
  };
}
