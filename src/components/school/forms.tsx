"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/app/school/actions";

export function CreateInlineForm({
  onSubmit,
  placeholder,
  submitLabel = "Add",
  extraPlaceholder,
  extraLabel,
  items,
  onDelete,
}: {
  onSubmit: (values: { name: string; code?: string }) => Promise<ActionState>;
  placeholder: string;
  submitLabel?: string;
  extraPlaceholder?: string;
  extraLabel?: string;
  items?: { id: string; name: string; extra?: string }[];
  onDelete?: (id: string) => Promise<ActionState>;
}) {
  const [main, setMain] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await onSubmit({
              name: main.trim(),
              code: extra.trim() || undefined,
            });
            if (result.ok) {
              setMain("");
              setExtra("");
            } else {
              setError(result.error);
            }
          });
        }}
      >
        {extraLabel && (
          <div className="grid min-w-28 flex-1 gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{extraLabel}</label>
            <Input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={extraPlaceholder}
              aria-label={extraPlaceholder}
            />
          </div>
        )}
        <div className="grid min-w-40 flex-1 gap-1.5">
          <Input
            value={main}
            onChange={(e) => setMain(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            required
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
          <Plus className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Adding…" : submitLabel}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {items && items.length > 0 && (
        <ul className="grid gap-1.5 pt-1">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onDelete,
}: {
  item: { id: string; name: string; extra?: string };
  onDelete?: (id: string) => Promise<ActionState>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <span className="font-medium">{item.name}</span>
        {item.extra && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {item.extra}
          </span>
        )}
      </span>
      {onDelete && (
        <span className="inline-flex items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Delete this item?")) return;
              setError(null);
              startTransition(async () => {
                const result = await onDelete(item.id);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </Button>
        </span>
      )}
    </li>
  );
}