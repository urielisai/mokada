import { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, Package, DollarSign, Clock, Users, Trophy } from 'lucide-react';
import { statusConfig } from '../pages/OrdersPage';

const COLORS = ['#0066CC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#6366F1'];

export const OrdersDashboard = ({ orders, agents = [] }: { orders: any[], agents?: any[] }) => {
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    
    // Only consider non-cancelled orders for revenue
    const validOrders = orders.filter(o => o.status !== 'CANCELLED');
    
    const totalRevenue = validOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const avgOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
    
    // Status distribution
    const statusCount = orders.reduce((acc: any, order) => {
      const label = statusConfig[order.status as keyof typeof statusConfig]?.label || order.status;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    
    const statusData = Object.entries(statusCount).map(([name, value]) => ({
      name,
      value
    }));

    // Revenue by date
    const salesByDate = validOrders.reduce((acc: any, order) => {
      const date = order.created_at.split('T')[0];
      acc[date] = (acc[date] || 0) + (order.total_amount || 0);
      return acc;
    }, {});

    const salesData = Object.entries(salesByDate)
      .map(([date, total]) => ({
        date,
        total,
        formattedDate: format(parseISO(date), 'dd MMM', { locale: es })
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days of sales

    // Orders by Agent
    const ordersByAgent = orders.reduce((acc: any, order) => {
      const agentId = order.created_by;
      const agent = agents.find(a => a.auth_user_id === agentId);
      if (agent) {
        acc[agent.name] = (acc[agent.name] || 0) + 1;
      }
      return acc;
    }, {});
    const topAgents = Object.entries(ordersByAgent)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count);

    // Top Customers
    const ordersByCustomer = validOrders.reduce((acc: any, order) => {
      const customerName = order.customers?.name || 'Cliente Desconocido';
      acc[customerName] = (acc[customerName] || 0) + 1;
      return acc;
    }, {});
    const topCustomers = Object.entries(ordersByCustomer)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Largest Orders
    const largestOrders = [...validOrders]
      .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
      .slice(0, 5);

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      statusData,
      salesData,
      pendingOrders: orders.filter(o => o.status === 'PENDING').length,
      topAgents,
      topCustomers,
      largestOrders
    };
  }, [orders, agents]);

  if (!orders || orders.length === 0) return null;

  return (
    <div className="space-y-6 mb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Ingresos Totales</h3>
            <DollarSign className="w-4 h-4 text-[#86868B]" />
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">
            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(metrics.totalRevenue)}
          </p>
        </div>

        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Pedidos Totales</h3>
            <Package className="w-4 h-4 text-[#86868B]" />
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{metrics.totalOrders}</p>
        </div>

        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Ticket Promedio</h3>
            <TrendingUp className="w-4 h-4 text-[#86868B]" />
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">
            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(metrics.avgOrderValue)}
          </p>
        </div>

        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Pendientes</h3>
            <Clock className="w-4 h-4 text-[#86868B]" />
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{metrics.pendingOrders}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-[#1D1D1F] mb-6">Ingresos (Últimos 14 días con ventas)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="formattedDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6B7280' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value), 'Ingresos']}
                />
                <Bar dataKey="total" fill="#0066CC" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-[#1D1D1F] mb-6">Estado de Pedidos</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {metrics.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Nuevas métricas: Top Agentes, Clientes y Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Top Agentes */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Pedidos por Agente</h3>
          </div>
          {metrics.topAgents.length === 0 ? (
            <p className="text-[13px] text-gray-500 italic">No hay datos de agentes.</p>
          ) : (
            <div className="space-y-4">
              {metrics.topAgents.map((agent, index) => (
                <div key={agent.name} className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1D1D1F]">
                    <span className="text-[#86868B] mr-2">{index + 1}.</span> {agent.name}
                  </span>
                  <span className="font-semibold text-[#1D1D1F]">{agent.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Clientes */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Clientes Frecuentes</h3>
          </div>
          <div className="space-y-4">
            {metrics.topCustomers.map((customer, index) => (
              <div key={customer.name} className="flex justify-between items-center text-[13px]">
                <span className="text-[#1D1D1F] truncate pr-4">
                  <span className="text-[#86868B] mr-2">{index + 1}.</span> {customer.name}
                </span>
                <span className="font-semibold text-[#1D1D1F] flex-shrink-0">
                  {customer.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Pedidos (Monto) */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Mayores Ventas</h3>
          </div>
          <div className="space-y-4">
            {metrics.largestOrders.map((order: any) => (
              <div key={order.id} className="flex justify-between items-center text-[13px] border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-col">
                  <span className="text-[#1D1D1F] truncate pr-2">
                    {order.customers?.name || 'Cliente'}
                  </span>
                  <span className="text-[#86868B] text-[11px] uppercase tracking-wider mt-0.5">Folio: {order.id.split('-')[0]}</span>
                </div>
                <span className="font-semibold text-[#1D1D1F] flex-shrink-0">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.total_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
