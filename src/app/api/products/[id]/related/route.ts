import { NextResponse } from "next/server";
import { getRelatedProducts } from "@/services/productService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing product id." }, { status: 400 });
    }

    const products = await getRelatedProducts(id, 4).catch(() => []);
    return NextResponse.json({ products });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load related products.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

