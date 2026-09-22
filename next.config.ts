import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "swissqrbill", "bcryptjs", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
