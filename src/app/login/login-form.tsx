"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, LogIn, Mail, Lock } from "lucide-react";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input } from "@/components/ui/field";

export function LoginForm({ suite }: { suite?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {suite && <input type="hidden" name="suite" value={suite} />}

      <Field label="Adresse e-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="toi@exemple.ch"
          icon={<Mail />}
        />
      </Field>

      <Field label="Mot de passe" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            icon={<Lock />}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-0 top-0 h-11 w-11 grid place-items-center text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors rounded-r-[var(--radius-sm)]"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <div className="pt-1">
        <CheckboxField
          id="persistent"
          name="persistent"
          defaultChecked
          label="Rester connecté"
          hint="Garde la session ouverte 90 jours, renouvelée à chaque utilisation. À décocher sur un appareil partagé."
        />
      </div>

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-px" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full mt-2">
        <LogIn />
        Se connecter
      </Button>
    </form>
  );
}
