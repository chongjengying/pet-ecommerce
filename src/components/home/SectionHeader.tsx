import Link from "next/link";

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actionHref,
  actionLabel,
  id,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div id={id} className="flex items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-umber/55">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-umber sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-umber/70">{subtitle}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="shrink-0 text-sm font-semibold text-sage hover:text-umber">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

