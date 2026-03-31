import Link from "next/link";
import AdminProductUploadForm from "@/components/admin/AdminProductUploadForm";

export const metadata = {
  title: "Add Product – PAWLUXE Admin",
  description: "Add a new product.",
};

export default function AdminNewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products"
          className="text-sm font-medium text-umber/70 hover:text-umber"
        >
          ← Products
        </Link>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-umber">Add product</h2>
      <AdminProductUploadForm />
    </div>
  );
}
