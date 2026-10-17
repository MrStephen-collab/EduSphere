"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setLowDataModeAction } from "@/app/school/actions";

/**
 * The school-wide data default (spec section 50).
 *
 * A learner who has saved their own choice keeps it; this only decides what
 * applies before they do, so a school on expensive connections can start its
 * students in Data Saver rather than Balanced.
 */
export function DataUsageCard({ lowDataMode }: { lowDataMode: boolean }) {
  const [enabled, setEnabled] = useState(lowDataMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setPending(true);
    setError(null);
    const result = await setLowDataModeAction(next);
    setPending(false);
    if (result.ok) {
      setEnabled(next);
    } else {
      setError(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" aria-hidden="true" />
          Data usage
        </CardTitle>
        <CardDescription>
          Turn this on so students start in Data Saver (video up to 360p) until they choose
          otherwise themselves. A student who has already picked a mode keeps it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Data Saver by default</p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "On — new students begin in Data Saver."
                : "Off — new students begin in Balanced (video up to 480p)."}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={pending}
            onCheckedChange={(next) => void toggle(next)}
            aria-label="Default students to Data Saver"
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
