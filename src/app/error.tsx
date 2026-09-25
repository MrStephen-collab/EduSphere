"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-dvh items-center justify-center bg-muted/30 p-6"
    >
      <div className="w-full max-w-md rounded-2xl border bg-background p-8 text-center shadow-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert className="size-7 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We hit an unexpected error on this page. Your work hasn&apos;t been
          lost — try again, and if it keeps happening, contact support.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              router.push("/");
            }}
            className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Go home
          </button>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-xs text-muted-foreground/60">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}