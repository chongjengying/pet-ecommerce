import Link from "next/link";
import GlassCard from "@/components/home/GlassCard";
import SectionHeader from "@/components/home/SectionHeader";

const needChips = [
  { label: "Sensitive tummy", q: "sensitive tummy" },
  { label: "Skin & coat", q: "skin" },
  { label: "Dental care", q: "dental" },
  { label: "Picky eater", q: "picky" },
  { label: "Joint support", q: "joint" },
  { label: "Shedding", q: "shedding" },
] as const;

export default function NeedChipsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:pb-14" id="shop-by-need">
      <GlassCard className="p-7 sm:p-8">
        <SectionHeader
          eyebrow="Shop by need"
          title="Start with what your pet is feeling."
          subtitle="Choose a concern and we’ll narrow the options—less scrolling, more care."
          actionHref="/products"
          actionLabel="Browse all"
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {needChips.map((chip) => (
            <Link
              key={chip.label}
              href={`/products?q=${encodeURIComponent(chip.q)}`}
              className="rounded-full border border-umber/15 bg-cream/60 px-4 py-2 text-sm font-semibold text-umber/80 transition hover:bg-amber-50 hover:text-umber"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

