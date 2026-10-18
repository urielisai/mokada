import { X } from 'lucide-react';
import { useEffect } from 'react';
import { usePresence } from '../../hooks/usePresence';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
}

const modalSizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export const Modal = ({ isOpen, onClose, title, children, maxWidth, size = 'md' }: Props) => {
  const { isMounted, state } = usePresence(isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isMounted) return null;

  const widthClass = maxWidth || modalSizeClasses[size] || size;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${isOpen ? '' : 'pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={title || undefined}
    >
      <div
        data-state={state}
        className="overlay-scrim absolute inset-0 bg-black/30 backdrop-blur-[6px]"
        onClick={onClose}
      />

      <div
        data-state={state}
        className={`overlay-dialog relative w-full min-w-0 max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] ${widthClass} overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5`}
      >
        <div className={`flex items-center justify-between gap-3 px-5 sm:px-6 ${title ? 'pt-5 pb-3' : 'pt-4 pb-0'}`}>
          <h3 className="text-[19px] font-semibold tracking-[-0.018em] text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="px-5 sm:px-6 pb-5 pt-2 max-h-[calc(100dvh-5rem)] sm:max-h-[calc(100dvh-6rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
