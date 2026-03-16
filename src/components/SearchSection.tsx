"use client";

import { useState } from "react";
import ProductSearch from "@/components/ProductsSearch";
import ProductCard from "@/components/ProductCard";
import { searchProducts } from "@/services/productService";
import { Product } from "@/types";

interface SearchSectionProps {
  allProducts: Product[];
}

export default function SearchSection({ allProducts }: SearchSectionProps) {
  const [displayProducts, setDisplayProducts] = useState<Product[]>(allProducts);

  async function handleSearch(keyword: string) {
    if (!keyword.trim()) {
      setDisplayProducts(allProducts);
      return;
    }
    const data = await searchProducts(keyword);
    setDisplayProducts(data ?? []);
  }

  return (
    <div className="w-full">
      <ProductSearch onSearch={handleSearch} />

      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayProducts.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </div>
  );
}