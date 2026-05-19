import Link from "next/link";

const products = Array.from({ length: 12 }).map((_, index) => ({
  id: index + 1,
  name: `PAWLUXE Formula ${index + 1}`,
  subtitle: index % 2 === 0 ? "Premium Dog Life Stage" : "Premium Continental Recipe",
}));

function ProductCard({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <article className="group rounded-2xl border border-[#e8e1d8] bg-[#f9f6f1] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative overflow-hidden rounded-xl bg-[radial-gradient(circle_at_30%_20%,_#d8b27f_0%,_#9e6f42_55%,_#5a3d25_100%)] p-3">
        <div className="mx-auto h-36 w-36 rounded-full border border-[#d6c6b2] bg-[radial-gradient(circle_at_30%_30%,_#d8bc88_0%,_#ab7947_55%,_#6b4528_100%)] shadow-inner" />
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-[#8e6b43] bg-[#3a2a1c]/90 px-3 py-2 text-center text-[#e6c18f]">
          <p className="text-sm font-semibold tracking-wide">{name}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#e9d0ad]/80">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}

export default function TestPage() {
  return (
    <main className="min-h-screen bg-[#f5f2ed] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[#2f241b]">PAWLUXE Product Test Page</h1>
          <Link href="/products" className="rounded-lg border border-[#d5cabd] bg-white px-3 py-1.5 text-sm font-medium text-[#4a3a2c] hover:bg-[#f6f1ea]">
            Back to products
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-2xl border border-[#ddd3c7] bg-white p-4 shadow-sm lg:sticky lg:top-5">
            <button className="mb-4 w-full rounded-lg border border-[#ddd2c4] px-3 py-2 text-left text-sm font-medium text-[#3f3023] hover:bg-[#faf7f3]">
              ✕ Clear All
            </button>

            <div className="space-y-4">
              <section>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#3a2b1f]">
                  <span>Shop by Pet</span>
                  <span>›</span>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#3a2b1f]">
                  <span>Categories</span>
                  <span>⌄</span>
                </div>
                <button className="w-full rounded-full bg-[#bd8645] px-3 py-2 text-left text-sm font-medium text-white">Dog Life Stages → Puppy</button>
              </section>

              <section>
                <p className="mb-2 text-sm font-semibold text-[#3a2b1f]">Bite Size</p>
                <div className="flex flex-wrap gap-2">
                  {["Small", "Medium", "Large"].map((size) => (
                    <button key={size} className="rounded-full border border-[#ddd2c4] bg-[#f8f5f1] px-3 py-1 text-xs text-[#564334]">
                      {size}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-sm font-semibold text-[#3a2b1f]">Food Texture</p>
                <div className="flex flex-wrap gap-2">
                  {["Food Texture", "Cooking"].map((texture) => (
                    <button key={texture} className="rounded-full border border-[#ddd2c4] bg-[#f8f5f1] px-3 py-1 text-xs text-[#564334]">
                      {texture}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#3a2b1f]">
                  <span>Brands</span>
                  <span>›</span>
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full rounded-full border border-[#ddd2c4] bg-[#fbf8f2] px-3 py-2 text-sm outline-none"
                />
              </section>

              <section>
                <p className="mb-2 text-sm font-semibold text-[#3a2b1f]">Price Range</p>
                <div className="h-1 rounded-full bg-[#dbcab7]" />
                <div className="mt-2 flex items-center justify-between text-xs text-[#6c5a4a]">
                  <span>Min $200</span>
                  <span>Max $1,000</span>
                </div>
              </section>

              <section>
                <p className="mb-2 text-sm font-semibold text-[#3a2b1f]">Paw-sonal Solutions</p>
                <div className="space-y-2">
                  {["Skin Health", "Joint Support"].map((item) => (
                    <button key={item} className="w-full rounded-full border border-[#ddd2c4] bg-[#f8f5f1] px-3 py-2 text-left text-sm text-[#4f3e30]">
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </aside>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-[#514132]">12 Pro-Level Solutions Filtered</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} name={product.name} subtitle={product.subtitle} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

