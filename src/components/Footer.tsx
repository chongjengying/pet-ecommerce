import Link from "next/link";

const primaryLinks = [
  { href: "/products", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [{ href: "/privacy-policy", label: "Privacy Policy" }];

export default function Footer() {
  return (
    <footer className="border-t border-amber-200/70 bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-bold tracking-wide text-umber">PAWLUXE</p>
            <p className="text-sm text-umber/70">Premium Pet Store</p>
          </div>

          <nav aria-label="Footer primary links" className="flex flex-wrap items-center gap-3 text-sm">
            {primaryLinks.map((link, idx) => (
              <span key={link.label} className="flex items-center gap-3">
                <Link href={link.href} className="font-medium text-umber/80 transition hover:text-umber">
                  {link.label}
                </Link>
                {idx < primaryLinks.length - 1 && <span className="text-umber/40">|</span>}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-amber-200/60 pt-4 sm:flex-row sm:items-center">
          <nav aria-label="Footer legal links" className="text-sm">
            {legalLinks.map((link) => (
              <Link key={link.label} href={link.href} className="text-umber/70 transition hover:text-umber">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="rounded-full border border-amber-300/70 p-2 text-umber/80 transition hover:bg-amber-100 hover:text-umber"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.16c3.2 0 3.58.01 4.84.07 3.24.15 4.77 1.69 4.93 4.93.06 1.26.07 1.64.07 4.84 0 3.2-.01 3.58-.07 4.84-.15 3.24-1.69 4.77-4.93 4.93-1.26.06-1.64.07-4.84.07-3.2 0-3.58-.01-4.84-.07-3.24-.15-4.77-1.69-4.93-4.93C2.17 15.58 2.16 15.2 2.16 12c0-3.2.01-3.58.07-4.84.15-3.24 1.69-4.77 4.93-4.93C8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.06.07 2.7.27.27 2.7.07 7.06.01 8.33 0 8.74 0 12s.01 3.67.07 4.94c.2 4.36 2.63 6.79 6.99 6.99 1.27.06 1.68.07 4.94.07s3.67-.01 4.94-.07c4.36-.2 6.79-2.63 6.99-6.99.06-1.27.07-1.68.07-4.94s-.01-3.67-.07-4.94C23.73 2.7 21.3.27 16.94.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
              </svg>
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="rounded-full border border-amber-300/70 p-2 text-umber/80 transition hover:bg-amber-100 hover:text-umber"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.38V2h-3.2v13.26a2.89 2.89 0 1 1-2-2.75V9.25a6.11 6.11 0 1 0 5.2 6V8.53a8.16 8.16 0 0 0 4.77 1.54V6.9c-.34 0-.67-.07-1-.21z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
