"use client";

import { useMemo, useState } from "react";
import ProductsSearch from "@/components/ProductsSearch";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/types";

interface SearchSectionProps {
  allProducts: Product[];
}

function filterProducts(products: Product[], keyword: string): Product[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return products;
  return products.filter((p) => {
    const name = (p.name ?? "").toLowerCase();
    const cat = (p.category ?? "").toLowerCase();
    return name.includes(k) || cat.includes(k);
  });
}

export default function SearchSection({ allProducts }: SearchSectionProps) {
  const [keyword, setKeyword] = useState("");

  const displayProducts = useMemo(() => filterProducts(allProducts, keyword), [allProducts, keyword]);

  return (
    <div className="w-full">
      <ProductsSearch keyword={keyword} onKeywordChange={setKeyword} />

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
