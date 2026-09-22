import { X } from 'lucide-react';
import { useEffect } from 'react';

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

  if (!isOpen) return null;

  const widthClass = maxWidth || modalSizeClasses[size] || size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className={`relative w-full min-w-0 max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] ${widthClass} bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
          <h3 className="text-[17px] font-semibold text-[#1D1D1F]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 sm:px-6 py-4 max-h-[calc(100dvh-5rem)] sm:max-h-[calc(100dvh-6rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
