"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { completeSetup, type SetupState } from "./actions";
import { CANTONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupForm() {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    completeSetup,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const strength = passwordStrength(password);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Le salon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Nom du salon"
            htmlFor="studioName"
            required
            error={state.fieldErrors?.studioName}
          >
            <Input
              id="studioName"
              name="studioName"
              required
              autoFocus
              placeholder="Encre Noire Tattoo"
            />
          </Field>

          <Field
            label="Ton nom"
            htmlFor="ownerName"
            required
            error={state.fieldErrors?.ownerName}
          >
            <Input id="ownerName" name="ownerName" required placeholder="Marc Ducrey" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Localité" htmlFor="city">
              <Input id="city" name="city" placeholder="Genève" />
            </Field>
            <Field label="Canton" htmlFor="canton">
              <Select
                id="canton"
                name="canton"
                placeholder="Non précisé"
                options={CANTONS.map((c) => ({ value: c.value, label: c.label }))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ton accès</CardTitle>
          <p className="text-[13px] text-[var(--fg-muted)]">
            C&apos;est le compte avec lequel tu te connecteras.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Adresse e-mail"
            htmlFor="email"
            required
            error={state.fieldErrors?.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              placeholder="marc@encrenoire.ch"
            />
          </Field>

          <Field
            label="Mot de passe"
            htmlFor="password"
            required
            error={state.fieldErrors?.password}
            hint="10 caractères minimum. Une phrase entière est plus sûre qu'un mot compliqué."
          >
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-0 top-0 h-11 w-11 grid place-items-center text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
                aria-label={showPassword ? "Masquer" : "Afficher"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          {password.length > 0 && (
            <div className="flex items-center gap-2 -mt-1">
              <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${strength.score * 25}%`,
                    background: strength.color,
                  }}
                />
              </div>
              <span className="text-[11px]" style={{ color: strength.color }}>
                {strength.label}
              </span>
            </div>
          )}

          <Field
            label="Confirme le mot de passe"
            htmlFor="confirm"
            required
            error={state.fieldErrors?.confirm}
          >
            <Input
              id="confirm"
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25">
        <ShieldCheck className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
          Cette page ne s&apos;affiche qu&apos;une fois : dès que le compte existe,
          elle se ferme automatiquement.
        </p>
      </div>

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Créer mon compte
        <ArrowRight />
      </Button>
    </form>
  );
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score++;

  const levels = [
    { label: "Trop court", color: "var(--danger)" },
    { label: "Faible", color: "var(--danger)" },
    { label: "Correct", color: "var(--warning)" },
    { label: "Bon", color: "var(--success)" },
    { label: "Excellent", color: "var(--success)" },
  ];

  return { score, ...levels[score] };
}
