"use client";

type ProductsSearchProps = {
  keyword: string;
  onKeywordChange: (value: string) => void;
};

export default function ProductsSearch({ keyword, onKeywordChange }: ProductsSearchProps) {
  return (
    <div className="flex w-full max-w-xl overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm ring-1 ring-transparent transition focus-within:border-terracotta/50 focus-within:ring-2 focus-within:ring-terracotta/20">
      <label htmlFor="search" className="sr-only">
        Search products
      </label>
      <span className="flex items-center pl-4 text-umber/50" aria-hidden>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </span>
      <input
        id="search"
        type="search"
        placeholder="Search by name or category…"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent py-3 px-3 text-umber placeholder:text-umber/45 focus:outline-none focus:ring-0"
      />
      {keyword ? (
        <button
          type="button"
          onClick={() => onKeywordChange("")}
          className="shrink-0 px-3 text-xs font-semibold uppercase tracking-wide text-umber/50 transition hover:text-umber"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
