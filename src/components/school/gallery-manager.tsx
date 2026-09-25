"use client";

import { useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addGalleryItemAction,
  deleteGalleryItemAction,
} from "@/app/school/actions";
import type { GalleryItem } from "@/services/school-media";

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

export function AddGalleryItemForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({ title: "", imageUrl: "", category: "" });

  return (
    <form
      className="grid gap-3 rounded-md border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addGalleryItemAction({
            title: values.title.trim() || null,
            imageUrl: values.imageUrl.trim(),
            category: values.category.trim() || null,
          });
          if (result.ok) {
            setValues({ title: "", imageUrl: "", category: "" });
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <p className="text-sm font-semibold">Add a photo</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ga-title">Title (optional)</Label>
          <Input
            id="ga-title"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="e.g. Sports day"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ga-cat">Category (optional)</Label>
          <Input
            id="ga-cat"
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            placeholder="e.g. Sports"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ga-url">Image URL</Label>
          <Input
            id="ga-url"
            type="url"
            value={values.imageUrl}
            onChange={(e) => setValues((v) => ({ ...v, imageUrl: e.target.value }))}
            placeholder="https://…"
            required
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <ImagePlus className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Adding…" : "Add photo"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

function GalleryItemCard({ item }: { item: GalleryItem }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <figure className="grid overflow-hidden rounded-md border bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.imageUrl} alt={item.title ?? "School photo"} className="aspect-[4/3] w-full object-cover" loading="lazy" />
      <figcaption className="grid gap-1 p-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{item.title ?? "Untitled photo"}</span>
          <span className="inline-flex items-center gap-1.5">
            {error && <span className="text-xs text-destructive">{error}</span>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm("Remove this photo from the gallery?")
                ) {
                  return;
                }
                setError(null);
                startTransition(async () => {
                  const result = await deleteGalleryItemAction(item.id);
                  if (!result.ok) setError(result.error);
                });
              }}
              aria-label="Remove photo"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {item.category && (
            <span className="rounded-full bg-muted px-2 py-0.5">{item.category}</span>
          )}
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </p>
      </figcaption>
    </figure>
  );
}

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
        No photos yet. Add your first one above.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <GalleryItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}