import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <span className="text-8xl font-extrabold tracking-tighter bg-gradient-to-br from-[#059669] to-[#10b981] bg-clip-text text-transparent">
            404
          </span>
        </div>

        <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
          Page not found
        </h2>
        <p className="text-[var(--color-text-muted)] text-base mb-10 max-w-sm mx-auto leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-[#059669] px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-[#10b981] hover:shadow-lg hover:shadow-[#059669]/20 active:scale-[0.98]"
          >
            Go home
          </Link>
          <Link
            href="/discover"
            className="rounded-xl border-2 border-[var(--color-bg-secondary)] px-7 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:border-[#059669] hover:text-[#059669]"
          >
            Discover content
          </Link>
        </div>
      </div>
    </div>
  );
}
