import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface ImageUploadProps {
  value?: string | File | null;
  onChange: (file: File | null) => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
}

export const ImageUpload = ({ value, onChange, onClear, disabled = false, className = '' }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onChange(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  // Determinar la URL de previsualización
  const previewUrl = value instanceof File 
    ? URL.createObjectURL(value) 
    : value;

  return (
    <div className={`relative ${className}`}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleChange}
        disabled={disabled}
      />
      
      {previewUrl ? (
        <div className="relative group w-full h-full rounded-2xl overflow-hidden border border-gray-200/60 bg-gray-50 flex items-center justify-center">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClick}
                className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                title="Cambiar imagen"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  if (onClear) onClear();
                }}
                className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors"
                title="Eliminar imagen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`w-full h-full min-h-[160px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-colors cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : ''}
            ${isDragging ? 'border-accent bg-accent/5' : 'border-gray-300 hover:border-accent/50 hover:bg-gray-50'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-[14px] font-medium text-ink text-center mb-1">
            Sube o toma una foto
          </p>
          <p className="text-[12px] text-muted text-center">
            Haz clic o arrastra aquí
          </p>
        </div>
      )}
    </div>
  );
};
