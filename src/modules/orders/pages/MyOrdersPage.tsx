import { useState, useEffect } from 'react';
import { ordersService } from '../services/orders.service';
import { supabase } from '../../../lib/supabase/client';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Package, Clock, Truck, CheckCircle2, XCircle, FileText, Loader2, Info, Plus, Minus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PaymentEvidenceModal } from '../components/PaymentEvidenceModal';
import { AddProductToOrderModal } from '../components/AddProductToOrderModal';
import toast from 'react-hot-toast';

const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  VALIDATING: { label: 'Validando Stock', color: 'bg-blue-100 text-blue-800', icon: FileText },
  CONFIRMED: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle2 },
  SHIPPED: { label: 'Enviado', color: 'bg-[#0066CC]/10 text-[#0066CC]', icon: Truck },
  DELIVERED: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export const MyOrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isUpdatingItem, setIsUpdatingItem] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders(true);
    
    // Subscribe to realtime updates for both orders and payments
    const channel = supabase.channel('my_orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_orders' },
        () => fetchOrders(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_order_payments' },
        () => fetchOrders(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRemoveItem = async (itemId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
    try {
      setIsUpdatingItem(itemId);
      await ordersService.removeOrderItem(itemId);
      fetchOrders();
      toast.success('Producto eliminado');
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar el producto');
    } finally {
      setIsUpdatingItem(null);
    }
  };

  const handleUpdateItemQuantity = async (itemId: string, currentQuantity: number, change: number) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity < 1) return;
    
    try {
      setIsUpdatingItem(itemId);
      await ordersService.updateOrderItemQuantity(itemId, newQuantity);
      fetchOrders();
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar la cantidad');
    } finally {
      setIsUpdatingItem(null);
    }
  };

  const fetchOrders = async (showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true);
      const data = await ordersService.getMyOrders();
      setOrders(data);
      
      // Update selected order if it exists
      setSelectedOrder((current: any) => {
        if (!current) return null;
        return data.find(o => o.id === current.id) || null;
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSubmit = async (amount: number, evidenceFile: File) => {
    if (!selectedOrder) return;
    await ordersService.registerPayment(selectedOrder.id, amount, 'TRANSFER', evidenceFile);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Mis Pedidos</h2>
        <p className="text-[15px] text-[#86868B] mt-1">Historial y estado de tus compras</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de pedidos */}
        <div className="lg:col-span-1 space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center flex flex-col items-center shadow-sm">
              <Package className="w-12 h-12 text-gray-300 mb-3 stroke-[1.5]" />
              <p className="text-[14px] text-[#86868B]">Aún no tienes pedidos.</p>
            </div>
          ) : (
            orders.map(order => {
              const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.PENDING;
              const StatusIcon = config.icon;
              const isSelected = selectedOrder?.id === order.id;

              return (
                <div 
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-[#0066CC] ring-1 ring-[#0066CC] shadow-md' 
                      : 'border-gray-200/60 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[12px] text-gray-500 font-medium">
                        {format(new Date(order.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                      <p className="text-[13px] font-mono text-[#1D1D1F] mt-0.5">
                        {order.id.split('-')[0].toUpperCase()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-50">
                    <p className="text-[13px] text-gray-600">
                      {order.sales_order_items.length} artículo(s)
                    </p>
                    <p className="text-[15px] font-bold text-[#1D1D1F]">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.total_amount)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detalle del pedido */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl shadow-sm overflow-hidden sticky top-6">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-[#1D1D1F]">
                    Pedido #{selectedOrder.id.split('-')[0].toUpperCase()}
                  </h3>
                  <p className="text-[13px] text-gray-500">
                    Realizado el {format(new Date(selectedOrder.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
                {selectedOrder.status === 'SHIPPED' && (
                   <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-[12px] font-semibold border border-green-200">
                     <Truck className="w-4 h-4" />
                     En camino
                   </span>
                )}
              </div>

              <div className="p-6 space-y-8">
                {/* Timeline / Status indicator */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                   <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                   <div>
                     <p className="text-[14px] font-medium text-blue-900">Estado actual: {statusConfig[selectedOrder.status as keyof typeof statusConfig]?.label}</p>
                     {selectedOrder.estimated_delivery_date && (
                        <p className="text-[13px] text-blue-700 mt-1">
                          Fecha estimada de entrega: <span className="font-semibold">{format(new Date(selectedOrder.estimated_delivery_date), "dd/MM/yyyy")}</span>
                        </p>
                     )}
                     {!selectedOrder.estimated_delivery_date && selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                        <p className="text-[13px] text-blue-700 mt-1">
                          Calculando fecha de entrega...
                        </p>
                     )}
                   </div>
                </div>

                {/* Comentarios del admin */}
                {selectedOrder.admin_comments && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <h4 className="text-[13px] font-semibold text-yellow-800 mb-1">Mensaje del equipo Mokada</h4>
                    <p className="text-[13px] text-yellow-700">{selectedOrder.admin_comments}</p>
                  </div>
                )}

                {/* Lista de productos */}
                <div>
                  <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                    <h4 className="text-[14px] font-semibold text-gray-900">Artículos</h4>
                    {(selectedOrder.status === 'PENDING' || selectedOrder.status === 'VALIDATING' || selectedOrder.status === 'CONFIRMED') && (
                      <button
                        onClick={() => setIsAddProductModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#0066CC] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Añadir Producto
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {selectedOrder.sales_order_items.map((item: any) => {
                      const isEditable = selectedOrder.status === 'PENDING' || selectedOrder.status === 'VALIDATING' || selectedOrder.status === 'CONFIRMED';
                      
                      return (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[14px] gap-2">
                          <div className="flex gap-3 items-center">
                            {isEditable ? (
                               <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                 <button 
                                   onClick={() => handleUpdateItemQuantity(item.id, item.quantity, -1)}
                                   disabled={item.quantity <= 1 || isUpdatingItem === item.id}
                                   className="p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                 >
                                   <Minus className="w-3 h-3" />
                                 </button>
                                 <span className="w-6 text-center text-xs font-medium text-[#1D1D1F]">
                                   {isUpdatingItem === item.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-gray-400" /> : item.quantity}
                                 </span>
                                 <button 
                                   onClick={() => handleUpdateItemQuantity(item.id, item.quantity, 1)}
                                   disabled={isUpdatingItem === item.id}
                                   className="p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                 >
                                   <Plus className="w-3 h-3" />
                                 </button>
                               </div>
                            ) : (
                              <span className="text-gray-500">{item.quantity}x</span>
                            )}
                            <span className="text-[#1D1D1F]">{item.products.name}</span>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                            <span className="text-[#1D1D1F] font-medium">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.subtotal)}
                            </span>
                            {isEditable && (
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={isUpdatingItem === item.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totales */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex justify-between text-[14px] text-gray-600">
                    <span>Subtotal</span>
                    <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(selectedOrder.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[14px] text-gray-600">
                    <span>Costo de envío</span>
                    <span>
                      {selectedOrder.shipping_cost > 0 
                        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(selectedOrder.shipping_cost)
                        : (selectedOrder.status === 'PENDING' ? 'Por definir' : 'Gratis')
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-[16px] font-bold text-[#1D1D1F] pt-2 border-t border-gray-100">
                    <span>Total General</span>
                    <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(selectedOrder.total_amount + Number(selectedOrder.shipping_cost))}</span>
                  </div>
                </div>

                {/* Sección de Pagos */}
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-[14px] font-semibold text-gray-900 mb-4">Pagos y Saldo</h4>
                  
                  {/* Progreso */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className="text-gray-500">Monto Pagado</span>
                      <span className="font-medium text-[#1D1D1F]">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(selectedOrder.amount_paid || 0)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-[#0066CC] h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(((selectedOrder.amount_paid || 0) / (selectedOrder.total_amount + Number(selectedOrder.shipping_cost))) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[13px] mt-2 border-t border-gray-200/60 pt-2">
                      <span className="text-gray-600 font-medium">Saldo Pendiente</span>
                      <span className="font-bold text-[#1D1D1F]">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                          Math.max((selectedOrder.total_amount + Number(selectedOrder.shipping_cost)) - (selectedOrder.amount_paid || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Lista de pagos */}
                  {selectedOrder.sales_order_payments?.length > 0 && (
                    <div className="space-y-3 mb-4">
                      <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider">Historial de Pagos</p>
                      {selectedOrder.sales_order_payments.map((payment: any) => (
                        <div key={payment.id} className="flex justify-between items-center text-[13px] p-3 bg-white border border-gray-100 rounded-lg">
                          <div>
                            <p className="font-medium text-[#1D1D1F]">{payment.payment_method === 'CASH' ? 'Efectivo' : 'Transferencia'}</p>
                            <p className="text-gray-500">{format(new Date(payment.created_at), "d MMM, yyyy", { locale: es })}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[#1D1D1F]">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.amount)}
                            </p>
                            <span className={`text-[11px] font-medium ${
                              payment.status === 'APPROVED' ? 'text-green-600' : 
                              payment.status === 'PENDING' ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {payment.status === 'APPROVED' ? 'Aprobado' : payment.status === 'PENDING' ? 'Pendiente' : 'Rechazado'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {((selectedOrder.total_amount + Number(selectedOrder.shipping_cost)) - (selectedOrder.amount_paid || 0)) > 0 && (
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full py-2.5 px-4 border border-[#0066CC] text-[#0066CC] font-medium text-[14px] rounded-xl hover:bg-[#0066CC]/5 transition-colors"
                    >
                      Reportar Pago (Transferencia)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200/50 rounded-2xl h-full min-h-[400px] flex items-center justify-center text-gray-400 text-sm">
              Selecciona un pedido para ver los detalles
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <PaymentEvidenceModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          orderId={selectedOrder.id}
          totalAmount={selectedOrder.total_amount + Number(selectedOrder.shipping_cost)}
          amountPaid={selectedOrder.amount_paid || 0}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {selectedOrder && (
        <AddProductToOrderModal
          isOpen={isAddProductModalOpen}
          onClose={() => setIsAddProductModalOpen(false)}
          orderId={selectedOrder.id}
          onProductAdded={() => fetchOrders()}
        />
      )}
    </div>
  );
};
