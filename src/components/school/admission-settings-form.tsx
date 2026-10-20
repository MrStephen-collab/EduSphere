"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateAdmissionSettingsAction } from "@/app/school/actions";
import {
  ADMISSION_FEE_CURRENCIES,
  admissionSettingsSchema,
} from "@/lib/admission-labels";
import type { AdmissionSettings } from "@/types/database";

// The datetime-local input speaks "YYYY-MM-DDTHH:mm" in whatever timezone the
// browser is in; the API speaks full ISO with an offset. These convert both
// ways so a saved window round-trips back into the form unchanged.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function fieldClass() {
  return "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
}

/** The public admissions page's URL, built from the school's slug. */
export function admissionUrl(slug: string): string {
  if (typeof window === "undefined") return `/schools/${slug}/admissions`;
  return `${window.location.origin}/schools/${slug}/admissions`;
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied -- leave the URL selectable below so the
      // admin can copy it by hand rather than silently failing.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? (
        <CheckCircle2 className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function AdmissionSettingsForm({
  settings,
  slug,
}: {
  settings: AdmissionSettings;
  slug: string;
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [opensAt, setOpensAt] = useState(isoToLocalInput(settings.opens_at));
  const [closesAt, setClosesAt] = useState(isoToLocalInput(settings.closes_at));
  const [intakeLabel, setIntakeLabel] = useState(settings.intake_label ?? "");
  const [introMessage, setIntroMessage] = useState(settings.intro_message ?? "");
  const [feeAmount, setFeeAmount] = useState(
    settings.application_fee_amount === null ? "" : String(settings.application_fee_amount),
  );
  const [feeCurrency, setFeeCurrency] = useState(settings.application_fee_currency);
  const [feeNote, setFeeNote] = useState(settings.fee_note ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const url = admissionUrl(slug);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    // Validate in the browser first so a bad window or a negative fee is
    // caught before the round trip. The same schema runs on the server.
    const parsed = admissionSettingsSchema.safeParse({
      enabled,
      opensAt: localInputToIso(opensAt),
      closesAt: localInputToIso(closesAt),
      intakeLabel: intakeLabel.trim() || null,
      introMessage: introMessage.trim() || null,
      applicationFeeAmount: feeAmount.trim() === "" ? undefined : Number(feeAmount),
      applicationFeeCurrency: feeCurrency,
      feeNote: feeNote.trim() || null,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? "Check the form and try again.");
      return;
    }

    startTransition(async () => {
      const result = await updateAdmissionSettingsAction(parsed.data);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {/* ---------------------------------------------------------------
          Link and window
      */}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Admission link</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Turn the link on to accept applications from your school&apos;s
              website. While it is off, the public form is hidden and no one can
              submit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="admission-enabled" className="text-sm">
              {enabled ? "On" : "Off"}
            </Label>
            <Switch
              id="admission-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="admission-url">Public link</Label>
          <div className="flex gap-2">
            <Input id="admission-url" readOnly value={url} className="font-mono text-xs" />
            <CopyLinkButton url={url} />
          </div>
          <p className="text-xs text-muted-foreground">
            Share this with prospective families. It only works while the link is on.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="admission-opens">Opens</Label>
            <input
              id="admission-opens"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className={fieldClass()}
            />
            <p className="text-xs text-muted-foreground">Leave empty to open immediately.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admission-closes">Closes</Label>
            <input
              id="admission-closes"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className={fieldClass()}
            />
            <p className="text-xs text-muted-foreground">Leave empty to keep it open.</p>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="admission-intake">Intake label</Label>
          <Input
            id="admission-intake"
            value={intakeLabel}
            onChange={(e) => setIntakeLabel(e.target.value)}
            placeholder="e.g. 2026/2027 Academic Session"
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">
            Shown to applicants so they know which session they are applying for.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="admission-intro">Intro message</Label>
          <textarea
            id="admission-intro"
            value={introMessage}
            onChange={(e) => setIntroMessage(e.target.value)}
            maxLength={600}
            rows={3}
            placeholder="A short paragraph shown above the application form."
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Application fee
      */}
      <section className="grid gap-4">
        <div>
          <h2 className="font-semibold">Application fee</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Shown to applicants on the admissions page. Leave the amount empty if
            there is no application fee.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="admission-fee-amount">Amount</Label>
            <Input
              id="admission-fee-amount"
              type="number"
              min={0}
              step="0.01"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="e.g. 2500"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admission-fee-currency">Currency</Label>
            <select
              id="admission-fee-currency"
              value={feeCurrency}
              onChange={(e) => setFeeCurrency(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {ADMISSION_FEE_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="admission-fee-note">Fee note</Label>
          <Input
            id="admission-fee-note"
            value={feeNote}
            onChange={(e) => setFeeNote(e.target.value)}
            placeholder="e.g. Non-refundable, payable at the school bursary"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            Applicants see this fee, but online payment is not set up yet -- they
            settle it with the school directly.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Feedback and submit
      */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save settings
        </Button>
        {saved ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Saved.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </form>
  );
}
