import { EduSphereLogo, BRAND_ACCENT, BRAND_LIGHT } from "@/components/brand/logo";

export function BrandLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-[55dvh] w-full flex-col items-center justify-center gap-7 px-6 ${className ?? ""}`}
    >
      <div className="relative flex size-32 items-center justify-center" aria-hidden="true">
        <div
          className="animate-loader-halo absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${BRAND_LIGHT}33 0%, transparent 68%)`,
          }}
        />
        <div className="absolute -inset-3 rounded-full border border-muted" />
        <div className="animate-loader-ring absolute -inset-3 rounded-full border-2 border-transparent border-t-[#0B7BFF] border-r-[#0B7BFF]/60" />
        <EduSphereLogo size={72} className="animate-logo-breathe" />
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium tracking-tight text-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className="loader-dot size-1.5 rounded-full bg-[#0B7BFF]" />
          <span
            className="loader-dot size-1.5 rounded-full bg-[#0B7BFF]"
            style={{ animationDelay: "0.18s" }}
          />
          <span
            className="loader-dot size-1.5 rounded-full"
            style={{ animationDelay: "0.36s", backgroundColor: BRAND_ACCENT }}
          />
        </div>
      </div>
    </div>
  );
}