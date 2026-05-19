import Link from "next/link";
import GlassCard from "@/components/home/GlassCard";
import SectionHeader from "@/components/home/SectionHeader";

const categories = [
  {
    title: "For Dogs",
    description: "Functional elegance for every stroll.",
    href: "/products?q=dogs",
    accent: "bg-[radial-gradient(circle_at_30%_20%,rgba(120,146,111,0.18),transparent_45%),linear-gradient(135deg,rgba(17,24,39,0.08),rgba(255,255,255,0.0))]",
  },
  {
    title: "For Cats",
    description: "Refined play for the discerning feline.",
    href: "/products?q=cats",
    accent: "bg-[radial-gradient(circle_at_25%_20%,rgba(193,127,89,0.22),transparent_55%),linear-gradient(135deg,rgba(17,24,39,0.06),rgba(255,255,255,0.0))]",
  },
  {
    title: "Small Pets",
    description: "Little details, big comfort.",
    href: "/products?q=small%20pets",
    accent: "bg-[radial-gradient(circle_at_40%_25%,rgba(251,191,36,0.20),transparent_55%),linear-gradient(135deg,rgba(17,24,39,0.05),rgba(255,255,255,0.0))]",
  },
  {
    title: "Home Goods",
    description: "Design that blends with your interior.",
    href: "/products?q=home",
    accent: "bg-[radial-gradient(circle_at_35%_25%,rgba(120,146,111,0.16),transparent_55%),linear-gradient(135deg,rgba(193,127,89,0.12),rgba(255,255,255,0.0))]",
  },
] as const;

export default function CollectiveSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-14">
      <SectionHeader
        id="collective"
        eyebrow="The Collective"
        title="Curated categories for every family member."
        actionHref="/products"
        actionLabel="View all categories"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Link href={categories[0].href} className="group block">
            <GlassCard className="relative overflow-hidden p-7 transition hover:-translate-y-0.5 hover:shadow-md sm:p-8">
              <div className={["absolute inset-0", categories[0].accent].join(" ")} />
              <div className="relative flex min-h-44 flex-col justify-end">
                <h3 className="text-2xl font-bold tracking-tight text-umber">{categories[0].title}</h3>
                <p className="mt-1 text-sm text-umber/70">{categories[0].description}</p>
                <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-white transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </GlassCard>
          </Link>
        </div>

        <div className="lg:col-span-5">
          <Link href={categories[1].href} className="group block">
            <GlassCard className="relative overflow-hidden p-7 transition hover:-translate-y-0.5 hover:shadow-md sm:p-8">
              <div className={["absolute inset-0", categories[1].accent].join(" ")} />
              <div className="relative flex min-h-44 flex-col justify-end">
                <h3 className="text-2xl font-bold tracking-tight text-umber">{categories[1].title}</h3>
                <p className="mt-1 text-sm text-umber/70">{categories[1].description}</p>
                <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-umber text-sm font-bold text-white transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </GlassCard>
          </Link>
        </div>

        <div className="lg:col-span-4">
          <Link href={categories[2].href} className="group block">
            <GlassCard className="relative overflow-hidden p-7 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={["absolute inset-0", categories[2].accent].join(" ")} />
              <div className="relative flex min-h-40 flex-col justify-end">
                <h3 className="text-xl font-bold tracking-tight text-umber">{categories[2].title}</h3>
                <p className="mt-1 text-sm text-umber/70">{categories[2].description}</p>
                <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-white transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </GlassCard>
          </Link>
        </div>

        <div className="lg:col-span-8">
          <Link href={categories[3].href} className="group block">
            <GlassCard className="relative overflow-hidden p-7 transition hover:-translate-y-0.5 hover:shadow-md sm:p-8">
              <div className={["absolute inset-0", categories[3].accent].join(" ")} />
              <div className="relative flex min-h-40 flex-col justify-end">
                <h3 className="text-2xl font-bold tracking-tight text-umber">{categories[3].title}</h3>
                <p className="mt-1 text-sm text-umber/70">{categories[3].description}</p>
                <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-umber text-sm font-bold text-white transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </GlassCard>
          </Link>
        </div>
      </div>
    </section>
  );
}

