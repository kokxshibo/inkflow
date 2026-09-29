"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2, PenLine } from "lucide-react";
import { acceptQuote, type AcceptState } from "./actions";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AcceptQuote({
  token,
  total,
  deposit,
}: {
  token: string;
  total: string;
  deposit: string | null;
}) {
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(
    acceptQuote,
    {},
  );

  if (state.success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--success-soft)] border border-[var(--success)]/30"
      >
        <CheckCircle2 className="size-5 text-[var(--success)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Devis accepté — merci !</p>
          <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
            Ton tatoueur a été prévenu et revient vers toi rapidement
            {deposit ? ` pour l'acompte de ${deposit} et la prise de rendez-vous` : ""}.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="size-4 text-[var(--accent)]" />
            Accepter ce devis
          </CardTitle>
          <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
            Montant total : <strong className="text-[var(--fg)]">{total}</strong>
            {deposit && (
              <>
                {" · acompte à verser : "}
                <strong className="text-[var(--accent)]">{deposit}</strong>
              </>
            )}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] border border-[var(--danger)]/25"
            >
              <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-px" />
              <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
            </div>
          )}

          <Field
            label="Ton nom complet"
            htmlFor="name"
            required
            hint="Vaut signature. Ton acceptation est horodatée."
          >
            <Input id="name" name="name" required placeholder="Léa Morand" />
          </Field>

          <CheckboxField
            id="agreed"
            name="agreed"
            label="J'accepte ce devis et ses conditions"
            hint="Notamment la politique d'acompte et d'annulation indiquée ci-dessous."
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            className="w-full"
          >
            <CheckCircle2 />
            Accepter le devis
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
