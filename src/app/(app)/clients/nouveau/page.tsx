import type { Metadata } from "next";
import { ClientWizard } from "./client-wizard";

export const metadata: Metadata = { title: "Nouveau client" };

export default function NewClientPage() {
  return <ClientWizard />;
}
