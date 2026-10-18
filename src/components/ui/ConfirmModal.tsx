import { Modal } from './Modal';
import { AlertTriangle, Info } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isPending?: boolean;
  variant?: 'danger' | 'destructive' | 'warning' | 'info' | string;
}

export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  isDestructive = false,
  isPending = false,
  variant
}: Props) => {
  const destructive = isDestructive || variant === 'danger' || variant === 'destructive';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="px-1 text-center">
        <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${destructive ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          {destructive ? (
            <AlertTriangle className="w-6 h-6" />
          ) : (
            <Info className="w-6 h-6" />
          )}
        </div>
        
        <h3 className="text-[19px] font-semibold text-ink mb-1.5">{title}</h3>
        <p className="text-[14px] leading-relaxed text-muted">{message}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="h-11 px-4 text-[15px] font-medium text-ink bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className={`h-11 px-4 text-[15px] font-medium text-white rounded-xl disabled:opacity-50 ${
            destructive
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-accent hover:bg-accent-hover'
          }`}
        >
          {isPending ? 'Procesando...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};
