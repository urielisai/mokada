import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  totalAmount: number;
  amountPaid: number;
  onSubmit: (amount: number, evidenceFile: File) => Promise<void>;
}

export const PaymentEvidenceModal = ({ isOpen, onClose, orderId, totalAmount, amountPaid, onSubmit }: PaymentEvidenceModalProps) => {
  const [amount, setAmount] = useState<string>((totalAmount - amountPaid).toString());
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingBalance = totalAmount - amountPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceFile) {
      toast.error('Debes adjuntar el comprobante de pago');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (numericAmount > remainingBalance) {
      toast.error(`El monto no puede superar el saldo pendiente ($${remainingBalance.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(numericAmount, evidenceFile);
      toast.success('Pago reportado exitosamente');
      onClose();
      // Reset state for next use
      setEvidenceFile(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al reportar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reportar Pago">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Saldo Pendiente
          </label>
          <p className="text-xl font-bold text-gray-900">${remainingBalance.toFixed(2)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto a Reportar *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              max={remainingBalance}
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comprobante (Transferencia) *
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Sube una imagen o captura de pantalla de tu transferencia.
          </p>
          <ImageUpload
            onChange={setEvidenceFile}
            value={evidenceFile}
            onClear={() => setEvidenceFile(null)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#0055AA] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Comprobante'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
