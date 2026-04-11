"use client";

import { useMemo, useState } from "react";
import ProductsSearch from "@/components/ProductsSearch";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/types";

interface SearchSectionProps {
  allProducts: Product[];
}

type SortKey = "popular" | "newest" | "price";
type PriceFilter = "all" | "under-50" | "50-100" | "100-200" | "200-plus";

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function inPriceRange(price: number, range: PriceFilter): boolean {
  if (range === "under-50") return price < 50;
  if (range === "50-100") return price >= 50 && price <= 100;
  if (range === "100-200") return price > 100 && price <= 200;
  if (range === "200-plus") return price > 200;
  return true;
}

function filterProducts(
  products: Product[],
  keyword: string,
  selectedSize: string,
  selectedColor: string,
  priceFilter: PriceFilter
): Product[] {
  const k = keyword.trim().toLowerCase();
  const size = normalizeText(selectedSize);
  const color = normalizeText(selectedColor);

  return products.filter((p) => {
    const name = normalizeText(p.name);
    const cat = normalizeText(p.category);
    const sizeLabel = normalizeText(p.size_label ?? p.size);
    const colorLabel = normalizeText(p.color);
    const price = Number(p.price ?? 0);

    const matchKeyword = !k || name.includes(k) || cat.includes(k);
    const matchSize = !size || sizeLabel === size;
    const matchColor = !color || colorLabel === color;
    const matchPrice = inPriceRange(price, priceFilter);

    return matchKeyword && matchSize && matchColor && matchPrice;
  });
}

function sortProducts(products: Product[], sortKey: SortKey, orderMap: Map<string, number>): Product[] {
  const list = [...products];
  if (sortKey === "price") {
    list.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
    return list;
  }

  if (sortKey === "newest") {
    list.sort((a, b) => {
      const aId = Number(a.id);
      const bId = Number(b.id);
      if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
      return String(b.id).localeCompare(String(a.id));
    });
    return list;
  }

  list.sort((a, b) => (orderMap.get(String(a.id)) ?? 0) - (orderMap.get(String(b.id)) ?? 0));
  return list;
}

export default function SearchSection({ allProducts }: SearchSectionProps) {
  const [keyword, setKeyword] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("popular");

  const sizeOptions = useMemo(() => {
    const values = new Set<string>();
    allProducts.forEach((product) => {
      const v = String(product.size_label ?? product.size ?? "").trim();
      if (v) values.add(v);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const colorOptions = useMemo(() => {
    const values = new Set<string>();
    allProducts.forEach((product) => {
      const v = String(product.color ?? "").trim();
      if (v) values.add(v);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const orderMap = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach((product, index) => {
      map.set(String(product.id), index);
    });
    return map;
  }, [allProducts]);

  const filteredProducts = useMemo(
    () => filterProducts(allProducts, keyword, selectedSize, selectedColor, priceFilter),
    [allProducts, keyword, selectedSize, selectedColor, priceFilter]
  );

  const displayProducts = useMemo(
    () => sortProducts(filteredProducts, sortKey, orderMap),
    [filteredProducts, sortKey, orderMap]
  );

  return (
    <div className="w-full">
      <ProductsSearch keyword={keyword} onKeywordChange={setKeyword} />
      <div className="mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Size</span>
          <select
            value={selectedSize}
            onChange={(event) => setSelectedSize(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          >
            <option value="">All sizes</option>
            {sizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Color</span>
          <select
            value={selectedColor}
            onChange={(event) => setSelectedColor(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          >
            <option value="">All colors</option>
            {colorOptions.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Price</span>
          <select
            value={priceFilter}
            onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          >
            <option value="all">All prices</option>
            <option value="under-50">Under RM 50</option>
            <option value="50-100">RM 50 - RM 100</option>
            <option value="100-200">RM 100 - RM 200</option>
            <option value="200-plus">Above RM 200</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Sort</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          >
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
            <option value="price">Price (low to high)</option>
          </select>
        </label>
      </div>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayProducts.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      {displayProducts.length === 0 ? (
        <p className="mt-8 text-center text-sm text-umber/60">No products match that search.</p>
      ) : null}
    </div>
  );
}
