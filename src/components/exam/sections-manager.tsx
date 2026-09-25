"use client";

import { useState, useTransition } from "react";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createSectionAction,
  deleteSectionAction,
} from "@/app/teacher/actions";
import type { ExamSectionItem } from "@/services/exam";

export function SectionsManager({
  seriesId,
  sections,
}: {
  seriesId: string;
  sections: ExamSectionItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");

  return (
    <div className="grid gap-3">
      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sections yet. Add sections like “Paper 1 — Objectives” to group
          questions into an ordered CBT paper.
        </p>
      ) : (
        <div className="grid gap-2">
          {sections.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {s.position + 1}. {s.title}
                </p>
                {s.instructions && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{s.instructions}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">
                  {s.questionCount} question{s.questionCount === 1 ? "" : "s"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm(`Delete section “${s.title}”? Its questions move back to "General".`)) return;
                    setError(null);
                    startTransition(async () => {
                      const result = await deleteSectionAction(s.id, seriesId);
                      if (!result.ok) setError(result.error);
                    });
                  }}
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="grid gap-2 rounded-md border border-dashed bg-background p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setError(null);
          startTransition(async () => {
            const result = await createSectionAction(seriesId, {
              title: title.trim(),
              instructions: instructions.trim() || null,
            });
            if (result.ok) {
              setTitle("");
              setInstructions("");
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <Label className="text-xs font-medium text-muted-foreground">Add a section</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section title, e.g. Paper 1 — Objectives"
            minLength={2}
            required
          />
          <Input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions (optional)"
          />
          <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <PlusCircle className="size-3.5" aria-hidden="true" />}
            Add
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  );
}