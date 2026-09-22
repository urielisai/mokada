import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';

export const DeliverySignatureModal = ({ isOpen, onClose, onConfirm, saving }: {
  isOpen: boolean; onClose: () => void;
  onConfirm: (name: string, signature: Blob) => Promise<void>;
  saving: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [recipientName, setRecipientName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setHasStroke(false); setRecipientName('');
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#1D1D1F'; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round';
    }
  }, [isOpen]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  };
  const clear = () => {
    const canvas = canvasRef.current; const context = canvas?.getContext('2d');
    if (canvas && context) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); setHasStroke(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipientName.trim() || !hasStroke) return;
    const blob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
    if (blob) await onConfirm(recipientName.trim(), blob);
  };

  return <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title="Firma de recibido" size="lg">
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[13px] text-[#86868B]">Pide a la persona que recibe la mercancía que escriba su nombre y firme aquí.</p>
      <label className="block text-[13px] font-medium text-[#1D1D1F]">Nombre de quien recibe
        <input required minLength={2} maxLength={120} disabled={saving} value={recipientName} onChange={e => setRecipientName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] outline-none" />
      </label>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2"><span className="text-[13px] font-medium">Firma</span><button type="button" disabled={saving} onClick={clear} className="flex items-center gap-1 text-[13px] text-[#0066CC]"><Eraser className="w-4 h-4" />Borrar firma</button></div>
        <canvas ref={canvasRef} width={600} height={200} aria-label="Área para firmar de recibido"
          className="block w-full h-[150px] sm:h-[180px] rounded-xl border border-gray-200 bg-white touch-none cursor-crosshair"
          onPointerDown={event => { if (saving) return; const canvas = canvasRef.current!; canvas.setPointerCapture(event.pointerId); const p = point(event); const context = canvas.getContext('2d')!; context.beginPath(); context.moveTo(p.x, p.y); drawing.current = true; }}
          onPointerMove={event => { if (!drawing.current) return; const p = point(event); const context = canvasRef.current!.getContext('2d')!; context.lineTo(p.x, p.y); context.stroke(); setHasStroke(true); }}
          onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
        {!hasStroke && <p className="text-[12px] text-[#86868B] mt-1">La firma es obligatoria para confirmar la entrega.</p>}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-100 pt-4">
        <button type="button" disabled={saving} onClick={onClose} className="w-full sm:w-auto rounded-lg border border-gray-200 px-4 py-2.5 text-[13px]">Cancelar</button>
        <button type="submit" disabled={saving || !hasStroke || recipientName.trim().length < 2} className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#0066CC] px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"><PenLine className="w-4 h-4" />{saving ? 'Guardando entrega…' : 'Confirmar entrega'}</button>
      </div>
    </form>
  </Modal>;
};
