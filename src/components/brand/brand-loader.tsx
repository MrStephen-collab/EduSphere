import { LogoMark } from "@/components/brand/logo";

export function BrandLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-[55dvh] w-full flex-col items-center justify-center gap-6 px-6 sm:gap-7 ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="es-loader-in">
        <LogoMark size={104} theme="auto" animated />
      </div>
      <div className="es-loader-in flex flex-col items-center gap-1" style={{ animationDelay: "0.15s" }}>
        <span className="whitespace-nowrap text-2xl font-bold tracking-tight text-[#123B8E] sm:text-3xl dark:text-white">
          Edu
          <span className="bg-clip-text text-transparent bg-linear-to-r from-[#1677E8] to-[#19A7F2] dark:from-[#19A7F2] dark:to-[#4AC0FF]">
            Sphere
          </span>
        </span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}