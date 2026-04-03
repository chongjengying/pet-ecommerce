export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-[#f5f5f7]">
      {children}
    </div>
  );
}
