import { BrandLoader } from "@/components/brand/brand-loader";

export function RouteLoading() {
  return (
    <div className="flex min-h-dvh justify-center bg-muted/30">
      <div className="flex w-full max-w-md flex-col bg-background sm:max-w-lg lg:max-w-3xl lg:border-x">
        <BrandLoader />
      </div>
    </div>
  );
}