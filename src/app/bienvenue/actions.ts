"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, needsSetup, setupKeyMatches } from "@/lib/auth";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/default-templates";

const schema = z
  .object({
    ownerName: z.string().trim().min(1, "Ton prénom et ton nom sont requis"),
    email: z.string().trim().email("Adresse e-mail invalide"),
    password: z.string().min(10, "10 caractères minimum"),
    confirm: z.string(),
    city: z.string().trim().default(""),
    canton: z.string().trim().default(""),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirm"],
  });

export interface SetupState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Création du compte propriétaire au premier lancement.
 * Protégée par `needsSetup()` : dès qu'un compte existe, la route est fermée.
 */
export async function completeSetup(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  if (!(await needsSetup())) {
    redirect("/login");
  }
  if (!setupKeyMatches(formData.get("cle"))) {
    return { error: "Lien d'installation invalide. Utilise le lien complet qui t'a été donné." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Certains champs doivent être corrigés.", fieldErrors };
  }

  const input = parsed.data;

  const user = await db.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.ownerName,
      passwordHash: await hashPassword(input.password),
      role: "owner",
    },
  });

  await db.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ownerName: input.ownerName,
      email: input.email.toLowerCase(),
      city: input.city,
      canton: input.canton || null,
      country: "CH",
    },
    update: {
      ownerName: input.ownerName,
      email: input.email.toLowerCase(),
      city: input.city,
      canton: input.canton || null,
    },
  });

  await db.personalSettings.upsert({
    where: { id: 1 },
    create: { id: 1, taxCanton: input.canton || null },
    update: {},
  });

  // Modèles d'e-mails prêts à l'emploi
  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {},
    });
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    persistent: true,
  });

  redirect("/tableau-de-bord?bienvenue=1");
}
