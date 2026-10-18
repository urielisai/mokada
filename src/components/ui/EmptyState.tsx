import { FolderSearch } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = ({ 
  title = 'No hay datos', 
  description = 'No se encontraron registros para mostrar.',
  icon,
  action
}: Props) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-black/[0.04] animate-fade-in">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        {icon || <FolderSearch className="h-7 w-7" strokeWidth={1.6} />}
      </div>
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[14px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};
