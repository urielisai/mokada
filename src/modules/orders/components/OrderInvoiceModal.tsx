import { Download, Printer } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { buildOrderInvoicePdf, invoiceRows, type OrderInvoiceDetails } from '../utils/orderInvoice';
import toast from 'react-hot-toast';

export const OrderInvoiceModal = ({ isOpen, onClose, order }: {
  isOpen: boolean; onClose: () => void;
  order: { id: string; invoice_details: OrderInvoiceDetails };
}) => {
  const print = () => {
    // Open immediately inside the user gesture so browsers allow the print window.
    const preview = window.open('', '_blank');
    if (!preview) { toast.error('Permite abrir la ventana para imprimir.'); return; }
    try {
      const doc = buildOrderInvoicePdf(order.id, order.invoice_details);
      doc.autoPrint();
      const url = URL.createObjectURL(doc.output('blob'));
      preview.opener = null; preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch { preview.close(); toast.error('No se pudo preparar la impresión.'); }
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="Datos para facturación" size="lg">
    <p className="text-[13px] text-[#86868B] mb-5">Datos fiscales seleccionados al crear el pedido.</p>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {invoiceRows(order.invoice_details).map(([label, value]) => <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <dt className="text-[12px] text-[#86868B] mb-1">{label}</dt>
        <dd className="text-[14px] text-[#1D1D1F] font-medium break-words">{value}</dd>
      </div>)}
    </dl>
    <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
      <button type="button" onClick={print} className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 text-[13px] font-medium"><Printer size={16} />Imprimir</button>
      <button type="button" onClick={() => buildOrderInvoicePdf(order.id, order.invoice_details).save(`facturacion-${order.id}.pdf`)} className="flex items-center gap-2 bg-[#0066CC] text-white rounded-lg px-4 py-2 text-[13px] font-medium"><Download size={16} />Descargar PDF</button>
    </div>
  </Modal>;
};
