import Image from "next/image";
import Link from "next/link";
import GlassCard from "@/components/home/GlassCard";

export default function HeroSection() {
  return (
    <section className="border-b border-amber-200/60 bg-cream px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <GlassCard className="relative overflow-hidden p-0 shadow-[0_18px_50px_rgba(44,36,32,0.18)]">
          <div className="relative min-h-[320px] sm:min-h-[420px]">
            <Image
              src="/HomePage.png"
              alt="PAWLUXE hero lifestyle"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 1100px"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-black/10" />
            <div className="absolute inset-0 bg-black/10" />

            <div className="relative flex h-full items-end p-6 sm:p-10">
              <div className="max-w-xl">
                <span className="inline-flex items-center rounded-full bg-amber-200/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-umber shadow-sm">
                  New Season 2026
                </span>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Elevate Your Pet&apos;s
                  <br />
                  Everyday Joy.
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
                  Discover curated premium essentials designed for the modern home and the companion who matters most.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/products"
                    className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta/90"
                  >
                    Shop New Arrivals
                  </Link>
                  <Link
                    href="#collective"
                    className="rounded-full bg-white/90 px-6 py-3 text-sm font-semibold text-umber shadow-sm ring-1 ring-black/[0.04] transition hover:bg-white"
                  >
                    View Lookbook
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
