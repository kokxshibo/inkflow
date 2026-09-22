"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Affiche le résultat d'un envoi puis nettoie l'URL. */
export function MailFlash({
  sent,
  simulated,
}: {
  sent?: boolean;
  simulated?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (sent) {
      toast.success("E-mail envoyé");
      router.replace("/messagerie");
    } else if (simulated) {
      toast.warning("Message enregistré mais non envoyé", {
        description: "Le SMTP n'est pas configuré. Rien n'a été expédié au client.",
        duration: 6000,
      });
      router.replace("/messagerie");
    }
  }, [sent, simulated, router]);

  return null;
}
