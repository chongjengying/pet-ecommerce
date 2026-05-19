import Link from "next/link";

export const footerConfig = {
  brand: {
    name: "PAWLUXE",
    tagline: "Premium Pet Store",
    description:
      "Elevated pet essentials, grooming, and lifestyle products curated for modern pet families.",
  },
  columns: [
    {
      title: "Shop",
      links: [
        { href: "/products", label: "All products" },
        { href: "/grooming", label: "Grooming" },
        { href: "/cart", label: "Cart" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: "About us" },
        { href: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Account",
      links: [
        { href: "/auth/login", label: "Sign in" },
        { href: "/auth/signup", label: "Create account" },
        { href: "/profile", label: "Profile" },
      ],
    },
  ],
  legal: [
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/contact", label: "Help & support" },
  ],
  social: [
    { href: "https://instagram.com", label: "Instagram", icon: "instagram" },
    { href: "https://tiktok.com", label: "TikTok", icon: "tiktok" },
  ],
} as const;

function SocialIcon({ name }: { name: "instagram" | "tiktok" }) {
  if (name === "instagram") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.16c3.2 0 3.58.01 4.84.07 3.24.15 4.77 1.69 4.93 4.93.06 1.26.07 1.64.07 4.84 0 3.2-.01 3.58-.07 4.84-.15 3.24-1.69 4.77-4.93 4.93-1.26.06-1.64.07-4.84.07-3.2 0-3.58-.01-4.84-.07-3.24-.15-4.77-1.69-4.93-4.93C2.17 15.58 2.16 15.2 2.16 12c0-3.2.01-3.58.07-4.84.15-3.24 1.69-4.77 4.93-4.93C8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.06.07 2.7.27.27 2.7.07 7.06.01 8.33 0 8.74 0 12s.01 3.67.07 4.94c.2 4.36 2.63 6.79 6.99 6.99 1.27.06 1.68.07 4.94.07s3.67-.01 4.94-.07c4.36-.2 6.79-2.63 6.99-6.99.06-1.27.07-1.68.07-4.94s-.01-3.67-.07-4.94C23.73 2.7 21.3.27 16.94.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.38V2h-3.2v13.26a2.89 2.89 0 1 1-2-2.75V9.25a6.11 6.11 0 1 0 5.2 6V8.53a8.16 8.16 0 0 0 4.77 1.54V6.9c-.34 0-.67-.07-1-.21z" />
    </svg>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-black/5 bg-[#fbf7ef]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,143,83,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(118,143,99,0.16),transparent_32%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="rounded-[2rem] border border-white/70 bg-white/60 p-6 shadow-2xl shadow-[#7b5b2e]/10 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-3xl font-black tracking-[-0.05em] text-[#211811] sm:text-4xl">
                {footerConfig.brand.name}
              </p>

              <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-[#9b6b38]">
                {footerConfig.brand.tagline}
              </p>

              <p className="mt-5 max-w-md text-sm leading-7 text-[#6f6253]">
                {footerConfig.brand.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="rounded-full bg-[#211811] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:-translate-y-0.5 hover:bg-[#3a2a1e]"
                >
                  Shop now
                </Link>

                <Link
                  href="/contact"
                  className="rounded-full border border-[#d6c3a6] bg-white/70 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#211811] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  Support
                </Link>
              </div>

              <div className="mt-7 flex items-center gap-2">
                {footerConfig.social.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-[#211811] shadow-sm transition hover:-translate-y-0.5 hover:border-[#211811] hover:bg-[#211811] hover:text-white"
                  >
                    <SocialIcon name={item.icon} />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-3 lg:col-span-7">
              {footerConfig.columns.map((column) => (
                <div key={column.title}>
                  <h2 className="text-xs font-black uppercase tracking-[0.22em] text-[#9b6b38]">
                    {column.title}
                  </h2>

                  <ul className="mt-5 space-y-3">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-sm font-medium text-[#6f6253] transition hover:text-[#211811] hover:underline hover:underline-offset-4"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-black/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-[#7b6d5d]">
              © {year} {footerConfig.brand.name}. All rights reserved.
            </p>

            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold">
              {footerConfig.legal.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[#7b6d5d] transition hover:text-[#211811] hover:underline hover:underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}