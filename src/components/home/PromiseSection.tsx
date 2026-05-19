import Link from "next/link";
import GlassCard from "@/components/home/GlassCard";

export default function PromiseSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:pb-14">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        <GlassCard className="relative overflow-hidden p-7 lg:col-span-7 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(193,127,89,0.14),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(120,146,111,0.12),transparent_55%)]" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-umber/55">The PAWLUXE promise</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-umber sm:text-3xl">
              Better for pets, beautiful for homes.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-umber/75 sm:text-base">
              Premium design meets everyday care—so your space stays calm, and your pet stays comfortable.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.04]">
                <p className="text-sm font-semibold text-umber">Eco-conscious quality</p>
                <p className="mt-1 text-sm text-umber/70">Materials chosen for comfort, safety, and longevity.</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.04]">
                <p className="text-sm font-semibold text-umber">Joy-tested designs</p>
                <p className="mt-1 text-sm text-umber/70">Every leash, bowl, and toy is made to feel good daily.</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.04]">
                <p className="text-sm font-semibold text-umber">Lifetime reliability</p>
                <p className="mt-1 text-sm text-umber/70">We stand by what we sell—because routines matter.</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-7 lg:col-span-5 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-umber/55">Need help?</p>
          <h3 className="mt-2 text-lg font-semibold text-umber">We’re here for you (and your pet).</h3>
          <p className="mt-2 text-sm leading-relaxed text-umber/70">
            Order updates, product guidance, or a thoughtful recommendation—reach out anytime.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/contact"
              className="rounded-2xl border border-umber/15 bg-cream/60 px-4 py-3 text-sm font-semibold text-umber transition hover:bg-amber-50"
            >
              Contact support
            </Link>
            <Link
              href="/profile/orders"
              className="rounded-2xl bg-umber px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-umber/90"
            >
              Track my order
            </Link>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

