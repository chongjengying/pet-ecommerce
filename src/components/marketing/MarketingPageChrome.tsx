import Link from "next/link";

type Crumb = { label: string; href?: string };

type MarketingPageChromeProps = {
  promoText?: string;
  breadcrumbs: Crumb[];
};

export default function MarketingPageChrome({
  promoText = "Free shipping on orders over RM99 · Premium pet care, delivered with care",
  breadcrumbs,
}: MarketingPageChromeProps) {
  return (
    <>
      <div className="border-b border-brand-border/80 bg-brand-promo py-2.5 text-center text-xs font-medium text-neutral-900 sm:text-sm">
        {promoText}
      </div>
      <nav aria-label="Breadcrumb" className="text-sm text-brand-accent">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {breadcrumbs.map((crumb, i) => (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && <span className="text-neutral-400" aria-hidden="true">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-neutral-900">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
