import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  id?: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
}

export function Table<T>({ 
  data, 
  columns, 
  isLoading, 
  isEmpty, 
  emptyTitle, 
  emptyMessage 
}: TableProps<T>) {
  if (isLoading) {
    return <LoadingState message="Cargando datos..." />;
  }

  if (isEmpty || (!isLoading && data.length === 0)) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] animate-fade-in">
      <table className="w-full text-[13px] text-left">
        <thead className="border-b border-gray-200/70 text-[12px] font-medium text-muted">
          <tr>
            {columns.map((col, idx) => (
              <th key={col.id || String(col.accessorKey || idx)} className={`px-5 py-3 whitespace-nowrap ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-ink">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="transition-colors duration-150 hover:bg-gray-50">
              {columns.map((col, colIndex) => (
                <td key={col.id || String(col.accessorKey || colIndex)} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.cell ? col.cell(row) : col.accessorKey ? (row[col.accessorKey] as React.ReactNode) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
