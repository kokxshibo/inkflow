"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, verifyCredentials } from "@/lib/auth";
import { logActivity } from "@/lib/db";

const schema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  persistent: z.coerce.boolean().default(true),
  suite: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

/** N'autorise qu'une redirection interne, jamais vers un domaine extérieur. */
function safeRedirect(target: string | undefined): string {
  if (!target) return "/tableau-de-bord";
  if (!target.startsWith("/") || target.startsWith("//")) {
    return "/tableau-de-bord";
  }
  return target;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    persistent: formData.get("persistent") === "on",
    suite: formData.get("suite") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: "E-mail ou mot de passe incorrect." };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    persistent: parsed.data.persistent,
  });
  await logActivity("auth.login", `Connexion de ${user.name}`, "user", user.id);

  redirect(safeRedirect(parsed.data.suite));
}
