import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersService } from '../services/orders.service';
import { Search, Filter, ShoppingCart, Loader2, FileText, CheckCircle2, Truck, XCircle, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../auth/context/useAuth';
import { useRouteScope } from '../../route-operations/hooks/useRouteScope';

export const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  VALIDATING: { label: 'Validando Stock', color: 'bg-blue-100 text-blue-800', icon: FileText },
  CONFIRMED: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle2 },
  SHIPPED: { label: 'Enviado', color: 'bg-accent/10 text-accent', icon: Truck },
  DELIVERED: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export const OrdersPage = ({ initialPaymentFilter = 'ALL' }: { initialPaymentFilter?: 'ALL' | 'UNPAID' | 'PAID' }) => {
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { matchesRoute } = useRouteScope();
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>(initialPaymentFilter);
  const isAgent = profile?.user_type === 'AGENT';

  const getPaymentSummary = (order: any) => {
    const total = Number(order.total_amount || 0);
    const paid = Number(order.amount_paid || 0);
    return { total, paid, remaining: Math.max(total - paid, 0), isPaid: total - paid <= 0.01 };
  };

  useEffect(() => {
    fetchOrders(true);

    const channel = supabase.channel('admin_orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_orders' },
        () => fetchOrders(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async (showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true);
      const data = await ordersService.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(search.toLowerCase()) || 
      order.customers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    const isInRoute = matchesRoute(order.customer_branches?.route_id);
    const { isPaid } = getPaymentSummary(order);
    const matchesPayment = paymentFilter === 'ALL' || (paymentFilter === 'PAID' ? isPaid : !isPaid);
    return matchesSearch && matchesStatus && isInRoute && matchesPayment;
  });

  const paymentCounts = orders.filter(order => matchesRoute(order.customer_branches?.route_id)).reduce((counts, order) => {
    if (getPaymentSummary(order).isPaid) counts.paid += 1;
    else counts.unpaid += 1;
    return counts;
  }, { paid: 0, unpaid: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-ink">{isAgent ? (initialPaymentFilter === 'PAID' ? 'Pedidos pagados' : 'Mis pedidos') : 'Ventas / Pedidos'}</h2>
          <p className="text-[15px] text-muted mt-1">{isAgent ? 'Pedidos y pagos de mis clientes' : 'Gestión de pedidos de clientes'}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {(isAdmin || profile?.user_type==='AGENT') && <button type="button" onClick={()=>{sessionStorage.removeItem('warranty-return-id');navigate('/catalog/products');}} className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-[14px] font-medium transition-colors whitespace-nowrap shadow-sm"><Plus className="w-4 h-4" />Nuevo pedido</button>}
          <div className="relative flex-1 min-w-[180px] sm:w-72 sm:flex-none">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por cliente o folio..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-10 pr-10 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] font-medium text-ink transition shadow-sm cursor-pointer"
            >
              <option value="ALL">Todos los estados</option>
              {Object.entries(statusConfig).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {isAgent && (
        <div className="flex w-full gap-1 overflow-x-auto rounded-xl border border-gray-200/60 bg-white p-1 shadow-sm sm:w-fit">
          {[
            { value: 'ALL', label: 'Todos', count: orders.length },
            { value: 'UNPAID', label: 'Pendientes de pago', count: paymentCounts.unpaid },
            { value: 'PAID', label: 'Pagados', count: paymentCounts.paid },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPaymentFilter(tab.value as 'ALL' | 'UNPAID' | 'PAID')}
              className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                paymentFilter === tab.value ? 'bg-accent text-white shadow-sm' : 'text-muted hover:bg-gray-50 hover:text-ink'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Folio</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Artículos</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                {isAgent && <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pago</th>}
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isAgent ? 7 : 6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={isAgent ? 7 : 6} className="px-6 py-12 text-center">
                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-[14px] text-gray-500">No se encontraron pedidos</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const StatusIcon = config.icon;
                  const payment = getPaymentSummary(order);

                  return (
                    <tr 
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-[13px] font-medium text-accent">
                          {order.id.split('-')[0].toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[13px] text-ink">
                            {format(new Date(order.created_at), "dd/MM/yyyy")}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {format(new Date(order.created_at), "HH:mm")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-medium text-ink">{order.customers?.name}</span>
                          <span className="text-[12px] text-gray-500">{order.customers?.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-[13px] text-gray-600">
                          {order.sales_order_items?.reduce((total: number, item: { quantity: number }) => total + Number(item.quantity || 0), 0) || 0} art.
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-[14px] font-bold text-ink">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.total)}
                        </span>
                      </td>
                      {isAgent && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${payment.isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {payment.isPaid ? 'Pagado' : `Pendiente ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.remaining)}`}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
