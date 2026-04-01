import Link from "next/link";
import MarketingPageChrome from "@/components/marketing/MarketingPageChrome";

export const metadata = {
  title: "Contact Us - PAWLUXE",
  description: "Contact Pawluxe for support, product questions, and collaborations.",
};

const card =
  "rounded-xl border border-brand-border bg-white p-6 shadow-sm sm:p-8";

const inputClass =
  "w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20";

const pillClass =
  "inline-flex items-center justify-center rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-brand-accent/50 hover:text-brand-accent";

export default function ContactPage() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-0 sm:px-6 lg:pb-16">
        <MarketingPageChrome
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Contact Us" },
          ]}
        />

        <div className={`mt-6 ${card}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Contact</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-3 text-base text-neutral-600">We&apos;d love to hear from you 🐾</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className={card}>
              <h2 className="text-xl font-bold text-neutral-900">Contact Information</h2>
              <div className="mt-4 space-y-3 text-sm text-neutral-600">
                <p>
                  <span className="font-semibold text-neutral-900">Email:</span>{" "}
                  <a
                    href="mailto:support@pawluxe.com"
                    className="text-brand-accent underline-offset-2 hover:underline"
                  >
                    support@pawluxe.com
                  </a>
                </p>
                <p>
                  <span className="font-semibold text-neutral-900">Phone:</span> +60 12-345 6789
                </p>
                <p>
                  <span className="font-semibold text-neutral-900">Location:</span> Malaysia
                </p>
              </div>
            </div>

            <div className={card}>
              <h2 className="text-xl font-bold text-neutral-900">Social Media</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className={pillClass}>
                  Instagram
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className={pillClass}>
                  Facebook
                </a>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className={pillClass}>
                  TikTok
                </a>
              </div>
            </div>

            <div className={card}>
              <h2 className="text-xl font-bold text-neutral-900">Business Hours</h2>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li>
                  <span className="font-semibold text-neutral-900">Mon–Fri:</span> 9AM – 6PM
                </li>
                <li>
                  <span className="font-semibold text-neutral-900">Sat:</span> 10AM – 4PM
                </li>
                <li>
                  <span className="font-semibold text-neutral-900">Sun:</span> Closed
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className={card}>
              <h2 className="text-xl font-bold text-neutral-900">Send us a message</h2>
              <form className="mt-4 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Name</span>
                  <input type="text" name="name" required className={inputClass} placeholder="Your name" />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Email</span>
                  <input
                    type="email"
                    name="email"
                    required
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Message</span>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className={inputClass}
                    placeholder="How can we help?"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-accent-hover"
                >
                  Submit
                </button>
              </form>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-neutral-900">Find Us</h2>
                <Link
                  href="https://maps.google.com/?q=Malaysia"
                  target="_blank"
                  className="text-sm font-medium text-brand-accent hover:underline"
                >
                  Open in Google Maps
                </Link>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-brand-border bg-neutral-50">
                <iframe
                  title="Pawluxe location map"
                  src="https://www.google.com/maps?q=Malaysia&output=embed"
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
