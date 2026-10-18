import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState = ({ 
  title = 'Ha ocurrido un error', 
  message = 'No pudimos cargar la información. Por favor, intenta de nuevo.',
  onRetry 
}: Props) => {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] animate-fade-in">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertTriangle className="h-7 w-7" strokeWidth={1.8} />
      </div>
      <h3 className="mb-1 text-[17px] font-semibold text-ink">{title}</h3>
      <p className="mb-6 max-w-sm text-[14px] leading-relaxed text-muted">{message}</p>
      
      {onRetry && (
        <button 
          onClick={onRetry}
          className="flex h-9 items-center gap-2 rounded-full bg-gray-100 px-4 text-[14px] font-medium text-ink hover:bg-gray-200"
        >
          <RefreshCcw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  );
};
