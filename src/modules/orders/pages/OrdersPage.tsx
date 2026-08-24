import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersService } from '../services/orders.service';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Search, Filter, ShoppingCart, Loader2, FileText, CheckCircle2, Truck, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../auth/context/useAuth';

export const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  VALIDATING: { label: 'Validando Stock', color: 'bg-blue-100 text-blue-800', icon: FileText },
  CONFIRMED: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle2 },
  SHIPPED: { label: 'Enviado', color: 'bg-[#0066CC]/10 text-[#0066CC]', icon: Truck },
  DELIVERED: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export const OrdersPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
      order.customers?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Ventas / Pedidos</h2>
          <p className="text-[15px] text-[#86868B] mt-1">Gestión de pedidos de clientes</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por cliente o folio..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-10 pr-10 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] font-medium text-[#1D1D1F] transition-all shadow-sm cursor-pointer"
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
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0066CC] mx-auto" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-[14px] text-gray-500">No se encontraron pedidos</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const StatusIcon = config.icon;

                  return (
                    <tr 
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-[13px] font-medium text-[#0066CC]">
                          {order.id.split('-')[0].toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[13px] text-[#1D1D1F]">
                            {format(new Date(order.created_at), "dd/MM/yyyy")}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {format(new Date(order.created_at), "HH:mm")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-medium text-[#1D1D1F]">{order.customers?.name}</span>
                          <span className="text-[12px] text-gray-500">{order.customers?.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-[13px] text-gray-600">
                          {order.sales_order_items?.length || 0} prod.
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-[14px] font-bold text-[#1D1D1F]">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.total_amount)}
                        </span>
                      </td>
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
