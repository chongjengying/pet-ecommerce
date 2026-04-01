import Link from "next/link";
import MarketingPageChrome from "@/components/marketing/MarketingPageChrome";

export const metadata = {
  title: "About Us - PAWLUXE",
  description: "Learn about Pawluxe, our story, mission, and love for pets.",
};

const card =
  "rounded-xl border border-brand-border bg-white p-6 shadow-sm sm:p-8";

const reasons = [
  {
    title: "High-quality products",
    description: "We carefully select products that meet quality and comfort standards for pets.",
  },
  {
    title: "Affordable pricing",
    description: "Premium does not have to mean expensive. We keep pricing fair and transparent.",
  },
  {
    title: "Fast delivery",
    description: "Your pet essentials arrive quickly so you can care for your pets without delay.",
  },
  {
    title: "Pet-safe materials",
    description: "We prioritize safety and reliability in every product listed on Pawluxe.",
  },
];

const coreValues = [
  { title: "Excellence", icon: "★" },
  { title: "Care", icon: "♡" },
  { title: "Innovation", icon: "💡" },
  { title: "Professionalism", icon: "🏅" },
  { title: "Consistency", icon: "⟳" },
  { title: "Enjoyment", icon: "☺" },
  { title: "Value for money", icon: "💰" },
];

export default function AboutPage() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-0 sm:px-6 lg:pb-16">
        <MarketingPageChrome
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "About Us" },
          ]}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className={`${card} flex flex-col justify-center`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">About Us</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              About Pawluxe
            </h1>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              Caring for your pets with quality and love
            </p>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              Pawluxe is built for pet parents who want products they can trust. We believe every pet
              deserves safe, quality essentials and every customer deserves a smooth and friendly shopping
              experience.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80"
              alt="Happy dog in a cozy setting"
              className="h-full min-h-[280px] w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <h2 className="text-xl font-bold text-neutral-900">Brand Story</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              Pawluxe was created to provide high-quality, affordable pet products for everyday pet care.
              Our brand is rooted in genuine love for pets and built on long-term customer trust.
            </p>
          </div>

          <div className={card}>
            <h2 className="text-xl font-bold text-neutral-900">Mission & Vision</h2>
            <div className="mt-3 space-y-3 text-sm text-neutral-600">
              <p>
                <span className="font-semibold text-neutral-900">Mission:</span> Provide safe, premium, and
                affordable pet products.
              </p>
              <p>
                <span className="font-semibold text-neutral-900">Vision:</span> Become a trusted pet brand
                in Malaysia.
              </p>
            </div>
          </div>
        </div>

        <div className={`mt-8 ${card}`}>
          <h2 className="text-center text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Core Values
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-relaxed text-neutral-600">
            Everything we do at Pawluxe is guided by values that shape how we serve pets and their
            families.
          </p>
          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {coreValues.map((value) => (
              <article
                key={value.title}
                className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-brand-border bg-neutral-50/50 p-4 text-center transition hover:border-brand-accent/40"
              >
                <span className="text-3xl leading-none text-brand-accent" aria-hidden="true">
                  {value.icon}
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-900">{value.title}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={`mt-8 ${card}`}>
          <h2 className="text-xl font-bold text-neutral-900">Why Choose Us</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {reasons.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-brand-border bg-neutral-50/30 p-4 transition hover:border-brand-accent/30"
              >
                <h3 className="text-sm font-semibold text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={`mt-8 ${card}`}>
          <h2 className="text-xl font-bold text-neutral-900">Founder</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            Hi, I am Jason, founder of Pawluxe. I am passionate about creating a pet brand that feels warm,
            honest, and dependable. My goal is simple: help pet families find products they feel good
            about, every single day.
          </p>
        </div>

        <div
          className={`mt-8 flex flex-col gap-4 rounded-xl border border-brand-border bg-neutral-50/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8`}
        >
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Ready to pamper your pets?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Explore our curated collections of pet essentials.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-accent-hover"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
