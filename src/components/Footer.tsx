import Link from "next/link";

/**
 * Edit this object to change footer links and labels — no layout changes needed.
 * Keep section titles short; use sentence case for link labels.
 */
export const footerConfig = {
  brand: {
    name: "PAWLUXE",
    tagline: "Premium Pet Store",
    description: "Thoughtful products and grooming for pets who share your home.",
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
    {
      href: "https://instagram.com",
      label: "Instagram",
      icon: "instagram",
    },
    {
      href: "https://tiktok.com",
      label: "TikTok",
      icon: "tiktok",
    },
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
    <footer className="border-t border-amber-200/80 bg-gradient-to-b from-cream via-cream to-amber-100/35">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand — wider column on large screens */}
          <div className="lg:col-span-4">
            <p className="text-lg font-bold tracking-[0.12em] text-umber">{footerConfig.brand.name}</p>
            <p className="mt-1 text-sm font-medium text-sage">{footerConfig.brand.tagline}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-umber/65">{footerConfig.brand.description}</p>
            <div className="mt-5 flex items-center gap-2">
              {footerConfig.social.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/60 bg-white/60 text-umber/75 shadow-sm transition hover:border-sage/50 hover:bg-white hover:text-umber"
                >
                  <SocialIcon name={item.icon} />
                </a>
              ))}
            </div>
          </div>

          {footerConfig.columns.map((column) => (
            <div key={column.title} className="lg:col-span-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-umber/45">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-umber/75 transition hover:text-sage focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage/60"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-amber-200/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-umber/50">
            © {year} {footerConfig.brand.name}. All rights reserved.
          </p>
          <nav aria-label="Legal and help" className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {footerConfig.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-umber/60 underline-offset-4 transition hover:text-umber hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
