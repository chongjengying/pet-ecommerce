import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const metadata = { title: "Vouchers - Pawluxe Admin", description: "Manage vouchers." };

export default async function AdminVouchersPage() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow="Promotion" title="Vouchers" description="Create and manage voucher campaigns." />
      <div className="rounded-2xl border border-amber-200/70 bg-white p-5">
        <pre className="text-xs text-zinc-700 overflow-auto">{JSON.stringify(data ?? [], null, 2)}</pre>
      </div>
    </div>
  );
}
