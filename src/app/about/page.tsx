import Image from "next/image";
import Link from "next/link";
import MarketingPageChrome from "@/components/marketing/MarketingPageChrome";

export const metadata = {
  title: "About Us - PAWLUXE",
  description: "Our story, promise, impact, and vision for pet families.",
};

const promiseItems = [
  {
    title: "Luxury Ingredients",
    desc: "Premium ingredients selected for quality, nutrition, and safety.",
  },
  {
    title: "Uncompromising Quality",
    desc: "Every product is curated with strict standards and consistency.",
  },
  {
    title: "Dedicated Support",
    desc: "Responsive support to help pet parents shop with confidence.",
  },
];

const impactItems = [
  { value: "1000+", label: "HAPPY PARENTS" },
  { value: "5+", label: "COUNTRIES" },
  { value: "PREMIUM", label: "PARTNERS" },
];

export default function AboutPage() {
  return (
    <section className="bg-[#efeae3]">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-0 sm:px-6 lg:pb-14">
        <MarketingPageChrome
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "About Us" },
          ]}
        />

        <div className="mt-4 overflow-hidden rounded-[26px] border border-[#d6cec2] bg-[#f6f3ee] shadow-[0_10px_30px_rgba(67,53,35,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
            <div className="border-b border-[#ddd3c6] p-6 lg:border-b-0 lg:border-r lg:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9d8d73]">About Us</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#1f1a16] sm:text-5xl">Our Story</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#3b332c]">
                Pawluxe was born from a simple belief: pet wellness should feel premium, safe, and approachable.
                We build a trusted ecosystem of products and services that helps pet families care better every day.
              </p>

              <div className="mt-5 overflow-hidden rounded-2xl border border-[#d9cebd]">
                <Image
                  src="/HomePage.png"
                  alt="Pawluxe story"
                  width={1200}
                  height={700}
                  className="h-56 w-full object-cover sm:h-64"
                />
              </div>

              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[#1f1a16]">The Pawluxe Promise</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {promiseItems.map((item) => (
                  <article key={item.title} className="rounded-xl border border-[#ddd1c2] bg-white/60 p-3">
                    <p className="text-sm font-semibold text-[#1f1a16]">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#4f463d]">{item.desc}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="p-6 lg:p-7">
              <h2 className="text-4xl font-semibold tracking-tight text-[#1f1a16]">The Pawluxe Promise</h2>
              <div className="mt-4 space-y-4">
                {promiseItems.map((item) => (
                  <div key={`right-${item.title}`} className="rounded-xl border border-[#ddd1c2] bg-white/70 p-4">
                    <p className="text-sm font-semibold text-[#1f1a16]">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#4f463d]">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-[#d9cebd] bg-white/65 p-4">
                <h3 className="text-3xl font-semibold tracking-tight text-[#1f1a16]">Global Vision</h3>
                <p className="mt-2 text-sm leading-6 text-[#4f463d]">
                  Expanding across Southeast Asia with Malaysia as our operational core.
                  We are building a regional pet ecosystem driven by quality and trust.
                </p>
              </div>
            </div>
          </div>

          <div className="grid border-t border-[#ddd3c6] lg:grid-cols-[1.25fr_1fr]">
            <div className="border-b border-[#ddd3c6] bg-[#efe7dc] p-6 lg:border-b-0 lg:border-r lg:p-7">
              <h2 className="text-center text-4xl font-semibold tracking-tight text-[#1f1a16]">Our Impact</h2>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {impactItems.map((item) => (
                  <article key={item.label} className="rounded-xl border border-[#d6cab8] bg-[#f7f3ec] p-4 text-center">
                    <p className="text-4xl font-semibold tracking-tight text-[#1f1a16]">{item.value}</p>
                    <p className="mt-1 text-xs font-semibold tracking-[0.14em] text-[#3f372f]">{item.label}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="bg-[#f6f3ee] p-6 lg:p-7">
              <h2 className="text-4xl font-semibold tracking-tight text-[#1f1a16]">Membership (Club Subscription)</h2>
              <div className="mt-4 rounded-2xl border border-[#bfa774] bg-[#fbf7ef] p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#1f1a16]">
                  Unlock exclusive discounts, grooming vouchers, and priority support.
                </p>
                <Link
                  href="/products"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#c88b3c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b57a2e]"
                >
                  JOIN THE CLUB →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
