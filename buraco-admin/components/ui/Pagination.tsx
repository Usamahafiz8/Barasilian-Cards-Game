interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end mt-4">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
      <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
    </div>
  );
}
