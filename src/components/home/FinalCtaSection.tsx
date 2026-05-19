import Link from "next/link";

export default function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="rounded-3xl border border-amber-200/70 bg-[linear-gradient(120deg,rgba(193,127,89,0.14),rgba(250,248,245,1))] p-7 shadow-sm sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-umber/55">Ready when you are</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-umber sm:text-3xl">
              Make the next restock effortless.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-umber/75 sm:text-base">
              Your pet’s essentials—delivered with care, clarity, and a premium touch.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-umber px-6 py-3 text-sm font-semibold text-white transition hover:bg-umber/90"
            >
              Shop essentials
            </Link>
            <Link
              href="/profile/orders"
              className="rounded-full border border-umber/20 bg-white px-6 py-3 text-sm font-semibold text-umber transition hover:bg-amber-50"
            >
              Track order
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-umber/20 bg-white/70 px-6 py-3 text-sm font-semibold text-umber transition hover:bg-amber-50"
            >
              Talk to support
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

