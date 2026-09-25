import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoading() {
  return (
    <div className="flex min-h-dvh justify-center bg-muted/30">
      <div className="flex h-dvh w-full max-w-md flex-col bg-background sm:max-w-lg lg:max-w-3xl lg:border-x">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-5 w-40" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="hidden size-9 rounded-full sm:block" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-4 pt-5 md:px-6">
          <Skeleton className="h-7 w-44" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-44 w-full" />
          </div>
        </main>

        <nav className="shrink-0 border-t px-4 py-3" aria-hidden="true">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-8 w-16 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}