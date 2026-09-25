"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBrandingAction } from "@/app/school/actions";

export type BrandingFormData = {
  name: string;
  motto: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export function BrandingForm({ initial }: { initial: BrandingFormData }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof BrandingFormData>(key: K, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setNotice(null);
        startTransition(async () => {
          const result = await updateBrandingAction(form);
          if (result.ok) {
            setNotice("School details and branding saved.");
          } else {
            setError(result.error);
          }
        });
      }}
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="brand-name">School name</Label>
          <Input id="brand-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-motto">Motto</Label>
          <Input id="brand-motto" value={form.motto} onChange={(e) => set("motto", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-email">Contact email</Label>
          <Input id="brand-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-phone">Phone</Label>
          <Input id="brand-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="brand-address">Address</Label>
          <Input id="brand-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-city">City</Label>
          <Input id="brand-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-state">State</Label>
          <Input id="brand-state" value={form.state} onChange={(e) => set("state", e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="brand-website">Website</Label>
          <Input id="brand-website" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://school.ng" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="brand-primary">Primary colour</Label>
          <div className="flex items-center gap-2">
            <input
              id="brand-primary"
              type="color"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="h-9 w-12 rounded border bg-background"
            />
            <span className="text-xs text-muted-foreground">{form.primaryColor}</span>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-secondary">Secondary colour</Label>
          <div className="flex items-center gap-2">
            <input
              id="brand-secondary"
              type="color"
              value={form.secondaryColor}
              onChange={(e) => set("secondaryColor", e.target.value)}
              className="h-9 w-12 rounded border bg-background"
            />
            <span className="text-xs text-muted-foreground">{form.secondaryColor}</span>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-accent">Accent colour</Label>
          <div className="flex items-center gap-2">
            <input
              id="brand-accent"
              type="color"
              value={form.accentColor}
              onChange={(e) => set("accentColor", e.target.value)}
              className="h-9 w-12 rounded border bg-background"
            />
            <span className="text-xs text-muted-foreground">{form.accentColor}</span>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        <Save className="mr-1 size-4" aria-hidden="true" />
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}