import { Modal } from './Modal';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success';
}

export const AlertModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'error'
}: Props) => {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-6 h-6" />;
      case 'success':
        return <CheckCircle2 className="w-6 h-6" />;
      case 'info':
      default:
        return <Info className="w-6 h-6" />;
    }
  };

  const getColorClass = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 text-red-600';
      case 'success':
        return 'bg-emerald-50 text-emerald-600';
      case 'info':
      default:
        return 'bg-blue-50 text-blue-600';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="px-1 text-center">
        <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${getColorClass()}`}>
          {getIcon()}
        </div>
        
        <h3 className="text-[19px] font-semibold text-ink mb-1.5">{title}</h3>
        <p className="text-[14px] leading-relaxed text-muted">{message}</p>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-full px-8 text-[15px] font-medium text-white bg-accent rounded-xl hover:bg-accent-hover"
        >
          Aceptar
        </button>
      </div>
    </Modal>
  );
};
