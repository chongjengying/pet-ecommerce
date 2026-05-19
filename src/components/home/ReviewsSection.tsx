import GlassCard from "@/components/home/GlassCard";
import SectionHeader from "@/components/home/SectionHeader";

const reviews = [
  {
    quote: "My picky Shiba finally finishes meals. The reorder flow is so calm and fast.",
    name: "Amelia",
    meta: "Verified buyer • Shiba Inu",
  },
  {
    quote: "Packaging felt premium, delivery updates were clear, and support was genuinely helpful.",
    name: "Haziq",
    meta: "Verified buyer • British Shorthair",
  },
  {
    quote: "Grooming booking was seamless. Our pup came home relaxed and smelling amazing.",
    name: "Jia Wen",
    meta: "Verified buyer • Toy Poodle",
  },
] as const;

export default function ReviewsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:pb-14">
      <SectionHeader title="Loved by pets. Trusted by people." subtitle="Quiet confidence from real routines." />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {reviews.map((r) => (
          <GlassCard
            key={r.name}
            className="p-6 transition hover:-translate-y-0.5 hover:shadow-md sm:p-7"
          >
            <p className="text-sm leading-relaxed text-umber/80">“{r.quote}”</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-umber">{r.name}</p>
                <p className="truncate text-xs font-semibold text-umber/55">{r.meta}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-umber/70 ring-1 ring-black/[0.04]">
                🐾
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

