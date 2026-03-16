"use client";

type TenantLogoProps = {
  logoUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { img: "h-8 w-8", text: "h-8 w-8 text-sm" },
  md: { img: "h-10 w-10", text: "h-10 w-10 text-base" },
  lg: { img: "h-14 w-14", text: "h-14 w-14 text-xl" },
};

export function TenantLogo({ logoUrl, name, size = "md", className = "" }: TenantLogoProps) {
  const s = sizeMap[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`${s.img} object-contain rounded ${className}`}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`${s.text} flex items-center justify-center rounded-lg font-bold text-white ${className}`}
      style={{ backgroundColor: "var(--color-accent, #059669)" }}
    >
      {initials}
    </div>
  );
}
