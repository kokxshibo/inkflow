import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome (server.js + dépendances strictement nécessaires) : c'est ce
  // qui est installé sur le VPS, sans le node_modules complet.
  output: "standalone",
  serverExternalPackages: [
    "pdfkit",
    "swissqrbill",
    "bcryptjs",
    "nodemailer",
    "imapflow",
    "mailparser",
  ],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
