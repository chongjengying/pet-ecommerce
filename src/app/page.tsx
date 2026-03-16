import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-cream">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-amber-200/60 bg-gradient-to-br from-amber-50 to-sage-light/30 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-umber sm:text-5xl md:text-6xl">
            Everything your pet deserves
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-umber/80">
            Quality food, toys, and grooming—all in one place. Shop products or book a dog grooming session.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/products"
              className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-terracotta/90"
            >
              Shop products
            </Link>
            <Link
              href="/test-db"
              className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-terracotta/90"
            >
             test
            </Link>
            <Link
              href="/grooming"
              className="rounded-full border-2 border-umber/20 bg-white px-6 py-3 text-sm font-semibold text-umber transition hover:border-umber/40 hover:bg-amber-50"
            >
              Book grooming
            </Link>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/products"
            className="group rounded-2xl border border-amber-200/60 bg-white p-6 shadow-sm transition hover:border-terracotta-light hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-terracotta transition group-hover:bg-terracotta group-hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-umber">Products</h2>
            <p className="mt-2 text-sm text-umber/70">Food, toys, beds, and more for dogs and cats.</p>
          </Link>
          <Link
            href="/grooming"
            className="group rounded-2xl border border-amber-200/60 bg-white p-6 shadow-sm transition hover:border-terracotta-light hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-light text-sage transition group-hover:bg-sage group-hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-umber">Dog Grooming</h2>
            <p className="mt-2 text-sm text-umber/70">Professional bath, trim, and nail care by appointment.</p>
          </Link>
          <Link
            href="/cart"
            className="group rounded-2xl border border-amber-200/60 bg-white p-6 shadow-sm transition hover:border-terracotta-light hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta-light text-terracotta transition group-hover:bg-terracotta group-hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-umber">Cart</h2>
            <p className="mt-2 text-sm text-umber/70">Review your items and checkout.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
