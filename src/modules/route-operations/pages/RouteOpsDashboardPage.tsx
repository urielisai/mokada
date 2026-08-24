import { useRouteOpsDashboard } from '../hooks/useRouteOperations';
import { LoadingState } from '../../../components/ui/LoadingState';
import { formatCurrency } from '../../../utils/formatters';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Route, Truck, Users, AlertCircle, ClipboardCheck, PieChart as PieChartIcon, BarChart2 } from 'lucide-react';

export const RouteOpsDashboardPage = () => {
  const { data: stats, isLoading } = useRouteOpsDashboard();

  if (isLoading) return <LoadingState message="Cargando dashboard..." />;

  const budgetData = [
    { name: 'Presupuesto', valor: stats?.totalBudget || 0 },
    { name: 'Gastado', valor: stats?.totalExpenses || 0 },
    { name: 'Pendientes', valor: stats?.pendingExpenses || 0 },
  ];

  const tripsData = [
    { name: 'Rutas Activas', value: stats?.activeTrips || 0, color: '#3b82f6' }, // Blue 500
    { name: 'En Revisión', value: stats?.pendingReview || 0, color: '#f59e0b' }, // Amber 500
    { name: 'Por Liquidar', value: stats?.pendingSettlements || 0, color: '#a855f7' }, // Purple 500
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isCurrency = payload[0].payload.valor !== undefined;
      return (
        <div className="bg-white border border-gray-200/60 shadow-lg rounded-xl p-3 text-[13px]">
          <p className="font-semibold text-[#1D1D1F] mb-1">{label || payload[0].name}</p>
          <p className="text-[#0066CC] font-medium">
            {isCurrency ? formatCurrency(payload[0].value) : `${payload[0].value} viajes`}
          </p>
        </div>
      );
    }
    return null;
  };

  const cards = [
    { label: 'Rutas activas', value: stats?.activeTrips || 0, icon: Route, color: 'bg-blue-50 text-blue-600', link: '/route-operations/trips' },
    { label: 'Agentes en ruta', value: stats?.agentsOnRoute || 0, icon: Users, color: 'bg-green-50 text-green-600', link: '/route-operations/trips' },
    { label: 'Pendientes de revisión', value: stats?.pendingReview || 0, icon: AlertCircle, color: 'bg-amber-50 text-amber-600', link: '/route-operations/trips' },
    { label: 'Pendientes de liquidar', value: stats?.pendingSettlements || 0, icon: ClipboardCheck, color: 'bg-purple-50 text-purple-600', link: '/route-operations/settlements' },
  ];

  return (
    <div className="space-y-6 pb-12">

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.link} className="group bg-white border border-gray-200/60 rounded-[20px] p-5 hover:shadow-md hover:border-gray-300 transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">{card.label}</h3>
              <card.icon className="w-4 h-4 text-[#86868B]" />
            </div>
            <p className="text-[28px] font-bold text-[#1D1D1F] tracking-tight">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Estado de los viajes */}
        <div className="bg-white border border-gray-200/60 rounded-[24px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Estado de los Viajes</h3>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tripsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {tripsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-[13px] text-[#1D1D1F] font-medium ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Presupuesto vs Gastos */}
        <div className="bg-white border border-gray-200/60 rounded-[24px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Resumen Financiero</h3>
          </div>

          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: '#86868B', fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: '#86868B' }}
                  tickFormatter={(val) => `$${val}`}
                  dx={-10}
                />
                <RechartsTooltip cursor={{ fill: '#F5F5F7' }} content={<CustomTooltip />} />
                <Bar dataKey="valor" fill="#0066CC" radius={[6, 6, 6, 6]} barSize={40} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/fleet/vehicles" className="flex items-center gap-3 bg-white border border-gray-200/60 rounded-xl p-4 hover:shadow-sm hover:border-[#0066CC]/30 transition-all">
          <Truck className="w-5 h-5 text-[#0066CC]" />
          <span className="text-[14px] font-medium text-[#1D1D1F]">Flotilla</span>
        </Link>
        <Link to="/route-operations/routes" className="flex items-center gap-3 bg-white border border-gray-200/60 rounded-xl p-4 hover:shadow-sm hover:border-[#0066CC]/30 transition-all">
          <Route className="w-5 h-5 text-[#0066CC]" />
          <span className="text-[14px] font-medium text-[#1D1D1F]">Rutas</span>
        </Link>
        <Link to="/route-operations/trips" className="flex items-center gap-3 bg-white border border-gray-200/60 rounded-xl p-4 hover:shadow-sm hover:border-[#0066CC]/30 transition-all">
          <Users className="w-5 h-5 text-[#0066CC]" />
          <span className="text-[14px] font-medium text-[#1D1D1F]">Viajes</span>
        </Link>
        <Link to="/route-operations/settlements" className="flex items-center gap-3 bg-white border border-gray-200/60 rounded-xl p-4 hover:shadow-sm hover:border-[#0066CC]/30 transition-all">
          <ClipboardCheck className="w-5 h-5 text-[#0066CC]" />
          <span className="text-[14px] font-medium text-[#1D1D1F]">Liquidaciones</span>
        </Link>
      </div>
    </div>
  );
};
