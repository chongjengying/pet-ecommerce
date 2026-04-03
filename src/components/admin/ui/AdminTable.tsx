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
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidthClassName} text-left text-sm`}>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold text-zinc-700">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: loadingRows }).map((_, index) => (
                  <tr key={index} className="border-b border-zinc-100">
                    {columns.map((column) => (
                      <td key={`${column}-${index}`} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
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
