import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersService } from '../services/orders.service';
import { statusConfig } from './OrdersPage';
import { ArrowLeft, Save, Loader2, Calendar, Plus, Minus, Trash2, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { generateReceiptPdf } from '../utils/generateReceiptPdf';
import { supabase } from '../../../lib/supabase/client';
import { Modal } from '../../../components/ui/Modal';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { AddProductToOrderModal } from '../components/AddProductToOrderModal';

export const OrderDetailsAdminPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Form states
  const [status, setStatus] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [adminComments, setAdminComments] = useState('');

  // Payment states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Reject states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [paymentToReject, setPaymentToReject] = useState<string | null>(null);
  const [rejectComments, setRejectComments] = useState('');
  
  // Items modifiers
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isUpdatingItem, setIsUpdatingItem] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    if (id) {
      fetchOrder(id, true);

      const channel = supabase.channel(`order_${id}_changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales_orders', filter: `id=eq.${id}` },
          () => fetchOrder(id, false)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales_order_payments', filter: `order_id=eq.${id}` },
          () => fetchOrder(id, false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('user_profiles').select('*').eq('auth_user_id', user.id).single();
      setCurrentUserProfile(data);
    }
  };

  const fetchOrder = async (orderId: string, showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true);
      const data = await ordersService.getOrderById(orderId);
      setOrder(data);
      setStatus(data.status);
      setShippingCost(data.shipping_cost?.toString() || '0');
      setEstimatedDate(data.estimated_delivery_date || '');
      setAdminComments(data.admin_comments || '');
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      const updates = {
        status,
        shipping_cost: Number(shippingCost) || 0,
        estimated_delivery_date: estimatedDate || null,
        admin_comments: adminComments
      };
      
      const updatedOrder = await ordersService.updateOrder(id, updates);
      setOrder({ ...order, ...updatedOrder });
      toast.success('Pedido actualizado');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar el pedido');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      await ordersService.markOrderAsDelivered(id);
      setOrder({ ...order, status: 'DELIVERED' });
      setStatus('DELIVERED');
      toast.success('Pedido marcado como entregado');
    } catch (error) {
      console.error(error);
      toast.error('Error al marcar como entregado');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      await ordersService.approvePayment(paymentId);
      toast.success('Pago aprobado');
      fetchOrder(id!);
    } catch (error) {
      console.error(error);
      toast.error('Error al aprobar el pago');
    }
  };

  const handleRejectPaymentClick = (paymentId: string) => {
    setPaymentToReject(paymentId);
    setRejectComments('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToReject) return;
    
    try {
      setIsProcessingPayment(true);
      await ordersService.rejectPayment(paymentToReject, rejectComments);
      toast.success('Pago rechazado');
      setIsRejectModalOpen(false);
      setPaymentToReject(null);
      setRejectComments('');
      fetchOrder(id!);
    } catch (error) {
      console.error(error);
      toast.error('Error al rechazar el pago');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleApproveCredit = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      await ordersService.approveCreditRequest(id);
      toast.success('Solicitud de crédito autorizada.');
      fetchOrder(id);
    } catch (err) {
      console.error(err);
      toast.error('Error al autorizar el crédito.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectCredit = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      await ordersService.rejectCreditRequest(id);
      toast.success('Solicitud de crédito rechazada.');
      fetchOrder(id);
    } catch (err) {
      console.error(err);
      toast.error('Error al rechazar la solicitud de crédito.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItemQuantity = async (itemId: string, currentQuantity: number, change: number) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity < 1) return;
    
    try {
      setIsUpdatingItem(itemId);
      await ordersService.updateOrderItemQuantity(itemId, newQuantity);
      fetchOrder(id!);
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar la cantidad');
    } finally {
      setIsUpdatingItem(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
    try {
      setIsUpdatingItem(itemId);
      await ordersService.removeOrderItem(itemId);
      fetchOrder(id!);
      toast.success('Producto eliminado');
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar el producto');
    } finally {
      setIsUpdatingItem(null);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido');
      return;
    }

    if (paymentMethod === 'TRANSFER' && !evidenceFile) {
      toast.error('Debes adjuntar el comprobante de transferencia');
      return;
    }

    try {
      setIsProcessingPayment(true);
      await ordersService.registerPayment(id, amount, paymentMethod, evidenceFile || undefined);
      
      if (paymentMethod === 'CASH') {
        toast.success('Pago en efectivo registrado (Aprobado automáticamente)');
      } else {
        toast.success('Pago por transferencia registrado. En espera de aprobación.');
      }
      
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setEvidenceFile(null);
      setPaymentMethod('CASH');
      fetchOrder(id);
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar el pago');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownloadReceipt = (payment: any) => {
    generateReceiptPdf({
      orderId: order.id,
      customerName: order.customers?.name || 'Cliente',
      agentName: currentUserProfile?.name || 'Agente Mokada',
      paymentMethod: 'Efectivo',
      amountPaidNow: payment.amount,
      totalOrderAmount: order.total_amount + (order.shipping_cost || 0),
      totalPreviouslyPaid: order.amount_paid - payment.amount, // roughly correct for display
      remainingBalance: Math.max((order.total_amount + (order.shipping_cost || 0)) - order.amount_paid, 0),
      date: format(new Date(payment.created_at), "dd/MM/yyyy HH:mm"),
      items: order.sales_order_items.map((item: any) => ({
        name: item.products?.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal
      }))
    });
  };

  if (isLoading || !order) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
      </div>
    );
  }

  const isShippedOrDelivered = order.status === 'SHIPPED' || order.status === 'DELIVERED' || order.status === 'CANCELLED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/orders')}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex justify-between items-center">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
              Pedido #{order.id.split('-')[0].toUpperCase()}
            </h2>
            <p className="text-[15px] text-[#86868B] mt-1">
              Realizado el {format(new Date(order.created_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
            </p>
          </div>
          
          <div className="flex gap-3">
            {order.status === 'SHIPPED' && (
              <button
                onClick={handleMarkDelivered}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-50"
              >
                Marcar Entregado
              </button>
            )}
            
            <button
              onClick={handleSave}
              disabled={isSaving || isShippedOrDelivered}
              className="bg-[#0066CC] hover:bg-[#005bb5] text-white px-6 py-2.5 rounded-xl text-[14px] font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      {order.payment_type === 'CREDITO' && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          order.credit_approval_status === 'PENDING'
            ? 'bg-purple-50 border-purple-200 text-purple-900'
            : order.credit_approval_status === 'APPROVED'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Modalidad de Pago: Crédito a {order.credit_term_days || 15} días
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                Estado de crédito: {
                  order.credit_approval_status === 'APPROVED'
                    ? `Autorizado ${order.due_date ? `(Fecha Límite de Pago: ${order.due_date})` : ''}`
                    : order.credit_approval_status === 'PENDING'
                    ? 'Pendiente de autorización por Administrador'
                    : 'Rechazado'
                }
              </p>
            </div>
          </div>

          {order.credit_approval_status === 'PENDING' && currentUserProfile?.user_type === 'ADMIN' && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleApproveCredit}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                Autorizar Crédito
              </button>
              <button
                type="button"
                onClick={handleRejectCredit}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                Rechazar
              </button>
            </div>
          )}
        </div>
      )}

      {isShippedOrDelivered && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm">
          Este pedido ya está en estado {statusConfig[order.status as keyof typeof statusConfig]?.label}. Ya no se pueden realizar modificaciones.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-semibold text-[#1D1D1F]">Gestión del Pedido</h3>
            
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isShippedOrDelivered}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] disabled:opacity-70 transition-all text-sm"
              >
                {Object.entries(statusConfig).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">
                Costo de Envío
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  disabled={isShippedOrDelivered}
                  className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] disabled:opacity-70 transition-all text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">
                Fecha Estimada de Entrega
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={estimatedDate}
                  onChange={(e) => setEstimatedDate(e.target.value)}
                  disabled={isShippedOrDelivered}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] disabled:opacity-70 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">
                Aclaraciones / Comentarios
              </label>
              <textarea
                value={adminComments}
                onChange={(e) => setAdminComments(e.target.value)}
                disabled={isShippedOrDelivered}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] disabled:opacity-70 transition-all text-sm h-28 resize-none"
                placeholder="Notas para el cliente..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Cliente</h3>
              <p className="font-medium text-[#1D1D1F]">{order.customers?.name}</p>
              <p className="text-sm text-gray-600">{order.customers?.email}</p>
              {order.customers?.phone && <p className="text-sm text-gray-600">{order.customers?.phone}</p>}
            </div>
            {order.shipping_address && (
              <div>
                <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Dirección de envío</h3>
                <p className="text-sm text-gray-600 max-w-xs">{order.shipping_address}</p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[#1D1D1F]">Artículos del Pedido</h3>
              {!isShippedOrDelivered && (
                <button
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#0066CC] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Añadir Producto
                </button>
              )}
            </div>
            
            <div className="space-y-4 border-b border-gray-100 pb-4">
              {order.sales_order_items?.map((item: any) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex gap-4 items-center">
                    {!isShippedOrDelivered ? (
                       <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                         <button 
                           onClick={() => handleUpdateItemQuantity(item.id, item.quantity, -1)}
                           disabled={item.quantity <= 1 || isUpdatingItem === item.id}
                           className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                         >
                           <Minus className="w-4 h-4" />
                         </button>
                         <span className="w-8 text-center text-sm font-medium text-[#1D1D1F]">
                           {isUpdatingItem === item.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-gray-400" /> : item.quantity}
                         </span>
                         <button 
                           onClick={() => handleUpdateItemQuantity(item.id, item.quantity, 1)}
                           disabled={isUpdatingItem === item.id}
                           className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                         >
                           <Plus className="w-4 h-4" />
                         </button>
                       </div>
                    ) : (
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                        {item.quantity}
                      </span>
                    )}
                    
                    <div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{item.products?.name}</p>
                      <p className="text-[12px] text-[#86868B]">{item.products?.code}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                    <div className="text-right">
                      <p className="text-[14px] font-medium text-[#1D1D1F]">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.subtotal)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.unit_price)} c/u
                      </p>
                    </div>
                    {!isShippedOrDelivered && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isUpdatingItem === item.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4 space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Costo de envío</span>
                <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(shippingCost) || 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#1D1D1F] pt-2 border-t border-gray-100">
                <span>Total General</span>
                <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.total_amount + (Number(shippingCost) || 0))}</span>
              </div>
            </div>
          </div>
          
          {/* Pagos Section */}
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm mt-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-[#1D1D1F]">Estado de Pagos</h3>
              {Math.max((order.total_amount + (Number(shippingCost) || 0)) - (order.amount_paid || 0), 0) > 0 && (
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="px-4 py-2 bg-[#0066CC] hover:bg-[#005bb5] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Registrar Pago
                </button>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-[13px] mb-2">
                <span className="text-gray-500">Monto Pagado</span>
                <span className="font-medium text-[#1D1D1F]">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.amount_paid || 0)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className="bg-[#0066CC] h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(((order.amount_paid || 0) / (order.total_amount + (Number(shippingCost) || 0))) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[13px] mt-2 border-t border-gray-200/60 pt-2">
                <span className="text-gray-600 font-medium">Saldo Pendiente</span>
                <span className="font-bold text-[#1D1D1F]">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                    Math.max((order.total_amount + (Number(shippingCost) || 0)) - (order.amount_paid || 0), 0)
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[13px] font-semibold text-gray-700">Historial de Pagos</h4>
              {order.sales_order_payments?.length === 0 && (
                <p className="text-sm text-gray-500 italic">No hay pagos registrados.</p>
              )}
              {order.sales_order_payments?.map((payment: any) => (
                <div key={payment.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{payment.payment_method === 'CASH' ? 'Efectivo' : 'Transferencia'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        payment.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        payment.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {payment.status === 'APPROVED' ? 'Aprobado' : payment.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-500">
                      {format(new Date(payment.created_at), "d MMM, yyyy HH:mm", { locale: es })}
                      {payment.created_by_user && ` • Por ${payment.created_by_user.email}`}
                    </p>
                    {payment.evidence_path && (
                      <a href={`${supabase.storage.from('payment-evidence').getPublicUrl(payment.evidence_path).data.publicUrl}`} target="_blank" rel="noreferrer" className="text-[12px] text-blue-600 hover:underline mt-1 inline-block">
                        Ver comprobante
                      </a>
                    )}
                    {payment.comments && (
                      <p className="text-[12px] text-red-600 mt-1 italic">"{payment.comments}"</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-[16px] font-bold text-gray-900">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.amount)}
                    </span>
                    
                    {payment.status === 'PENDING' && currentUserProfile?.user_type === 'ADMIN' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApprovePayment(payment.id)} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium">
                          Aprobar
                        </button>
                        <button onClick={() => handleRejectPaymentClick(payment.id)} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium">
                          Rechazar
                        </button>
                      </div>
                    )}

                    {payment.status === 'APPROVED' && payment.payment_method === 'CASH' && (
                      <button onClick={() => handleDownloadReceipt(payment)} className="text-[13px] text-[#0066CC] hover:underline font-medium">
                        Descargar Recibo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Registrar Pago">
        <form onSubmit={handleRegisterPayment} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CASH"
                  checked={paymentMethod === 'CASH'}
                  onChange={() => setPaymentMethod('CASH')}
                  className="text-[#0066CC] focus:ring-[#0066CC]"
                />
                <span className="text-sm">Efectivo (Automático)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="TRANSFER"
                  checked={paymentMethod === 'TRANSFER'}
                  onChange={() => setPaymentMethod('TRANSFER')}
                  className="text-[#0066CC] focus:ring-[#0066CC]"
                />
                <span className="text-sm">Transferencia</span>
              </label>
            </div>
          </div>

          {paymentMethod === 'CASH' && (
            <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
              Al registrar un pago en efectivo, este quedará <strong>aprobado automáticamente</strong> y se descontará del saldo del pedido de forma inmediata.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto Cobrado *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={Math.max((order.total_amount + (Number(shippingCost) || 0)) - (order.amount_paid || 0), 0)}
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="pl-8 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC]"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Saldo pendiente: ${Math.max((order.total_amount + (Number(shippingCost) || 0)) - (order.amount_paid || 0), 0).toFixed(2)}</p>
          </div>

          {paymentMethod === 'TRANSFER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comprobante (Transferencia) *
              </label>
              <ImageUpload
                onChange={setEvidenceFile}
                value={evidenceFile}
                onClear={() => setEvidenceFile(null)}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessingPayment}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#005bb5] disabled:opacity-50"
            >
              {isProcessingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Rechazar Pago">
        <form onSubmit={handleConfirmRejectPayment} className="space-y-4">
          <p className="text-sm text-gray-600 mb-2">
            ¿Estás seguro de que deseas rechazar este pago? Puedes dejar un motivo para el cliente.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (Opcional)</label>
            <textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 h-24 resize-none"
              placeholder="Ej. El comprobante está borroso o el monto no coincide."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessingPayment}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isProcessingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Rechazo'}
            </button>
          </div>
        </form>
      </Modal>

      <AddProductToOrderModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        orderId={order.id}
        onProductAdded={() => fetchOrder(order.id)}
      />
    </div>
  );
};
