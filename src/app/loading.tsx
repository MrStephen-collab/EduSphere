import { BrandLoader } from "@/components/brand/brand-loader";

export default function Loading() {
  return (
    <div className="flex min-h-dvh w-full bg-background">
      <BrandLoader />
    </div>
  );
}