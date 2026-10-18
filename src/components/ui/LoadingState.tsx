import { Spinner } from './Spinner';

interface Props {
  message?: string;
  className?: string;
}

export const LoadingState = ({ message = 'Cargando...', className = '' }: Props) => {
  return (
    <div className={`flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl bg-white p-8 text-muted shadow-sm ring-1 ring-black/[0.04] animate-fade-in ${className}`}>
      <Spinner className="h-6 w-6" label={message} />
      <p className="text-[13px]">{message}</p>
    </div>
  );
};
