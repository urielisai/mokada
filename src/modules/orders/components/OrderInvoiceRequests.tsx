import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Loader2, Trash2, Printer, Download } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { ordersService } from '../services/orders.service';
import { useCustomerFiscalProfiles } from '../../customers/hooks/useCustomers';
import { invoicePaymentForms, buildOrderInvoicePdf, invoiceRows } from '../utils/orderInvoice';
import toast from 'react-hot-toast';

export const OrderInvoiceRequests = ({ order }: { order: any }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useQuery({
    queryKey: ['order-invoice-requests', order.id],
    queryFn: () => ordersService.getInvoiceRequests(order.id)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ordersService.deleteInvoiceRequest(id),
    onSuccess: () => {
      toast.success('Solicitud eliminada');
      queryClient.invalidateQueries({ queryKey: ['order-invoice-requests', order.id] });
    },
    onError: (error: any) => toast.error(error.message || 'Error al eliminar')
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: 'PENDING' | 'INVOICED' }) => ordersService.updateInvoiceRequestStatus(id, status),
    onSuccess: () => {
      toast.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['order-invoice-requests', order.id] });
    },
    onError: (error: any) => toast.error(error.message || 'Error al actualizar')
  });

  const availableItems = useMemo(() => {
    if (!requests) return order.sales_order_items.map((i: any) => ({ ...i, available_quantity: i.quantity }));
    return order.sales_order_items.map((item: any) => {
      const usedQuantity = requests.reduce((sum: number, req: any) => {
        const reqItem = req.items.find((ri: any) => ri.order_item?.id === item.id);
        return sum + (reqItem ? reqItem.quantity : 0);
      }, 0);
      return { ...item, available_quantity: item.quantity - usedQuantity };
    });
  }, [order.sales_order_items, requests]);

  const fullyInvoiced = availableItems.every((i: any) => i.available_quantity === 0);

  const print = (request: any) => {
    const preview = window.open('', '_blank');
    if (!preview) { toast.error('Permite abrir la ventana para imprimir.'); return; }
    try {
      const doc = buildOrderInvoicePdf(order.id, request.invoice_details);
      doc.autoPrint();
      const url = URL.createObjectURL(doc.output('blob'));
      preview.opener = null; preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch { preview.close(); toast.error('No se pudo preparar la impresión.'); }
  };

  if (isLoading) return <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></div>;

  return (
    <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-semibold text-[#1D1D1F]">Solicitudes de Facturación</h3>
          <p className="text-[13px] text-gray-500 mt-1">Este pedido requiere factura. Puedes dividir la facturación en múltiples solicitudes.</p>
        </div>
        {!fullyInvoiced && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0066CC] text-white text-sm font-medium rounded-lg hover:bg-[#005bb5] transition-colors">
            <Plus size={16} /> Nueva Solicitud
          </button>
        )}
      </div>

      {requests?.length === 0 ? (
        <p className="text-sm text-gray-500 italic py-4">No hay solicitudes de facturación creadas aún.</p>
      ) : (
        <div className="space-y-4">
          {requests?.map((req: any) => (
            <div key={req.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={16} className="text-gray-500" />
                  <span className="font-medium text-[14px] text-gray-900">{req.invoice_details.legal_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${req.status === 'INVOICED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {req.status === 'INVOICED' ? 'FACTURADO' : 'PENDIENTE'}
                  </span>
                </div>
                <p className="text-[12px] text-gray-500">RFC: {req.invoice_details.rfc} · {req.items.reduce((acc: number, item: any) => acc + item.quantity, 0)} artículos incluidos</p>
              </div>
              <div className="flex gap-2">
                {req.status === 'PENDING' ? (
                  <button onClick={() => statusMutation.mutate({ id: req.id, status: 'INVOICED' })} disabled={statusMutation.isPending} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium">Marcar Facturado</button>
                ) : (
                  <button onClick={() => statusMutation.mutate({ id: req.id, status: 'PENDING' })} disabled={statusMutation.isPending} className="px-3 py-1.5 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg text-xs font-medium">Marcar Pendiente</button>
                )}
                <button onClick={() => { setSelectedRequest(req); setIsViewModalOpen(true); }} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium">Ver Datos</button>
                <button onClick={() => deleteMutation.mutate(req.id)} disabled={deleteMutation.isPending} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      {isModalOpen && (
        <NewInvoiceRequestModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          order={order} 
          availableItems={availableItems} 
        />
      )}

      {/* View Request Modal */}
      {selectedRequest && (
        <Modal isOpen={isViewModalOpen} onClose={() => { setIsViewModalOpen(false); setSelectedRequest(null); }} title="Datos de Facturación" size="lg">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {invoiceRows(selectedRequest.invoice_details).map(([label, value]) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <dt className="text-[12px] text-[#86868B] mb-1">{label}</dt>
                <dd className="text-[14px] text-[#1D1D1F] font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <h4 className="text-[13px] font-semibold text-gray-700 mb-2">Artículos a facturar:</h4>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {selectedRequest.items.map((item: any) => (
                <div key={item.id} className="p-3 text-[13px] flex justify-between bg-white">
                  <span>{item.quantity}x {item.order_item?.products?.name}</span>
                  <span className="font-medium">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.quantity * item.order_item?.unit_price)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => print(selectedRequest)} className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 text-[13px] font-medium"><Printer size={16} />Imprimir</button>
            <button type="button" onClick={() => buildOrderInvoicePdf(order.id, selectedRequest.invoice_details).save(`facturacion-${order.id}.pdf`)} className="flex items-center gap-2 bg-[#0066CC] text-white rounded-lg px-4 py-2 text-[13px] font-medium"><Download size={16} />Descargar PDF</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const NewInvoiceRequestModal = ({ isOpen, onClose, order, availableItems }: { isOpen: boolean, onClose: () => void, order: any, availableItems: any[] }) => {
  const [fiscalProfileId, setFiscalProfileId] = useState('');
  const [paymentForm, setPaymentForm] = useState('UNDEFINED');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  const fiscalProfiles = useCustomerFiscalProfiles(order.customer_id);
  const activeFiscalProfiles = fiscalProfiles.data?.filter(p => p.is_active) || [];
  const selectedFiscalProfile = activeFiscalProfiles.find(p => p.id === fiscalProfileId);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const itemsToInclude = Object.entries(quantities)
        .filter(([_, q]) => q > 0)
        .map(([id, q]) => ({ order_item_id: id, quantity: q }));
      
      if (itemsToInclude.length === 0) throw new Error('Debes incluir al menos un producto.');
      if (!fiscalProfileId) throw new Error('Selecciona un perfil fiscal.');

      return ordersService.createInvoiceRequest(order.id, order.customer_id, fiscalProfileId, paymentForm, itemsToInclude);
    },
    onSuccess: () => {
      toast.success('Solicitud de facturación creada');
      queryClient.invalidateQueries({ queryKey: ['order-invoice-requests', order.id] });
      onClose();
    },
    onError: (error: any) => toast.error(error.message || 'Error al crear la solicitud')
  });

  const handleSelectAll = () => {
    const newQs: Record<string, number> = {};
    availableItems.forEach(item => {
      if (item.available_quantity > 0) newQs[item.id] = item.available_quantity;
    });
    setQuantities(newQs);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Solicitud de Factura" size="xl">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <label className="block text-[13px] font-medium mb-1">Información de facturación *</label>
            <select value={fiscalProfileId} onChange={e => setFiscalProfileId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-[#0066CC]/20 focus:border-[#0066CC]">
              <option value="">Seleccionar perfil fiscal</option>
              {activeFiscalProfiles.map(p => <option key={p.id} value={p.id}>{p.legal_name} · {p.rfc}</option>)}
            </select>
            {selectedFiscalProfile && <p className="text-[11px] text-gray-500 mt-1">RFC: {selectedFiscalProfile.rfc} · Uso CFDI: {selectedFiscalProfile.cfdi_use}</p>}
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1">Forma de pago *</label>
            <select value={paymentForm} onChange={e => setPaymentForm(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-[#0066CC]/20 focus:border-[#0066CC]">
              {invoicePaymentForms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-[14px] font-medium">Productos a facturar</label>
            <button type="button" onClick={handleSelectAll} className="text-[12px] text-[#0066CC] hover:underline font-medium">Seleccionar todos los disponibles</button>
          </div>
          
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {availableItems.length === 0 && <p className="p-4 text-sm text-gray-500">No hay productos en este pedido.</p>}
            {availableItems.map(item => (
              <div key={item.id} className="p-3 sm:p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#1D1D1F]">{item.products?.name}</p>
                  <p className="text-[11px] text-[#86868B]">{item.products?.code} · {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.unit_price)} c/u</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-500">Disp: {item.available_quantity}</span>
                  <input 
                    type="number" 
                    min="0" 
                    max={item.available_quantity}
                    value={quantities[item.id] !== undefined ? quantities[item.id] : ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= item.available_quantity) {
                        setQuantities(prev => ({...prev, [item.id]: val}));
                      } else if (e.target.value === '') {
                        setQuantities(prev => ({...prev, [item.id]: 0}));
                      }
                    }}
                    placeholder="0"
                    disabled={item.available_quantity === 0}
                    className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] disabled:opacity-50 disabled:bg-gray-50"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
             <p className="text-[14px] font-medium">Total de artículos: {Object.values(quantities).reduce((a,b)=>a+b,0)}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !fiscalProfileId || Object.values(quantities).reduce((a,b)=>a+b,0) === 0} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#005bb5] disabled:opacity-50 disabled:bg-gray-400">
            {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
            Guardar Solicitud
          </button>
        </div>
      </div>
    </Modal>
  );
};
