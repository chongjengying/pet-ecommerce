export type CatalogProductStatus = "draft" | "active" | "archived";

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  category_id: string;
  category_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  status: CatalogProductStatus;
  featured: boolean;
  thumbnail_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
