import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="size-6" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-4xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The page you are looking for does not exist or you may not have access to it.
      </p>
      <div className="mt-6">
        <Button render={<Link href="/" />}>Back to home</Button>
      </div>
    </div>
  );
}