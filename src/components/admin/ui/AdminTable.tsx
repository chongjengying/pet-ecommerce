interface AdminTableProps {
  columns: string[];
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  minWidthClassName?: string;
  loading?: boolean;
  loadingRows?: number;
  isEmpty?: boolean;
}

export default function AdminTable({
  columns,
  children,
  emptyState,
  minWidthClassName = "min-w-[880px]",
  loading = false,
  loadingRows = 5,
  isEmpty = false,
}: AdminTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidthClassName} text-left text-sm`}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/85">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr]:transition-colors [&_tr:hover]:bg-slate-50/70">
            {loading
              ? Array.from({ length: loadingRows }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    {columns.map((column) => (
                      <td key={`${column}-${index}`} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              : children}
          </tbody>
        </table>
      </div>
      {!loading && isEmpty && emptyState ? <div className="px-6 py-12 text-center">{emptyState}</div> : null}
    </div>
  );
}
