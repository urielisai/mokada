import { useDashboardStats } from '../hooks/useDashboardStats';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useAuth } from '../../auth/context/useAuth';
import { Navigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { HeartPulse, Boxes, Users, Banknote, Award } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

export const DashboardPage = () => {
  const { isAdmin } = useAuth();
  const { data: stats, isLoading, isError, refetch } = useDashboardStats();

  if (!isAdmin) {
    return <Navigate to="/my-route" replace />;
  }

  if (isLoading) return <LoadingState message="Cargando resumen..." />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  // 1. Datos para Composición del Catálogo (Barras)
  const catalogData = [
    { name: 'Productos', valor: stats?.productsCount || 0 },
    { name: 'Marcas', valor: stats?.brandsCount || 0 },
    { name: 'Categorías', valor: stats?.categoriesCount || 0 },
    { name: 'Almacenes', valor: stats?.warehousesCount || 0 },
  ];

  // 2. Datos para Estado del Inventario (Donut)
  // Aseguramos no tener valores negativos
  const outOfStock = stats?.outOfStockCount || 0;
  const lowStock = stats?.lowStockCount || 0;
  const totalStocked = (stats?.productsCount || 0) - lowStock - outOfStock;
  const normalStock = totalStocked > 0 ? totalStocked : 0;

  const inventoryData = [
    { name: 'Stock Normal', value: normalStock, color: '#34C759' }, // System green
    { name: 'Bajo Stock', value: lowStock, color: '#FF9F0A' },      // System orange
    { name: 'Agotados', value: outOfStock, color: '#FF3B30' },      // System red
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="material-popover rounded-xl px-3 py-2.5 text-[13px] shadow-lg ring-1 ring-black/[0.06]">
          <p className="font-semibold text-ink mb-1">{label || payload[0].name}</p>
          <p className="text-accent font-medium">
            {payload[0].value} unidades
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-ink">Análisis y métricas</h2>
        <p className="mt-1 text-[15px] text-muted">Panorama del inventario, catálogo y desempeño comercial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger">
        
        {/* Gráfico 1: Salud del Inventario */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <HeartPulse className="w-4 h-4 text-muted" />
            <h3 className="text-[15px] font-semibold text-ink">Salud del Inventario</h3>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={3}
                  cornerRadius={6}
                  animationDuration={700}
                  dataKey="value"
                  stroke="none"
                >
                  {inventoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-[13px] text-ink font-medium ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Composición del Catálogo */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Boxes className="w-4 h-4 text-muted" />
            <h3 className="text-[15px] font-semibold text-ink">Composición del Catálogo</h3>
          </div>

          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={catalogData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#E8E8ED" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: '#6E6E73', fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: '#6E6E73' }}
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: '#F5F5F7' }}
                  content={<CustomTooltip />}
                />
                <Bar 
                  dataKey="valor" 
                  fill="#0071E3" 
                  radius={[8, 8, 8, 8]}
                  barSize={40}
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger">
        
        {/* Top 5 Clientes */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-4 h-4 text-muted" />
            <h3 className="text-[15px] font-semibold text-ink">Top Clientes (Compras)</h3>
          </div>
          <div className="space-y-4">
            {stats?.topCustomers?.length ? (
              stats.topCustomers.map((c: any, idx: number) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-accent font-semibold text-xs tabular-nums">
                      {idx + 1}
                    </div>
                    <p className="text-[13px] font-medium text-ink line-clamp-1">{c.name}</p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-ink-2">
                    {formatCurrency(c.total)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted">No hay datos suficientes.</p>
            )}
          </div>
        </div>

        {/* Top 5 Agentes (Pedidos) */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2 mb-6">
            <Award className="w-4 h-4 text-muted" />
            <h3 className="text-[15px] font-semibold text-ink">Top Agentes (Pedidos)</h3>
          </div>
          <div className="space-y-4">
            {stats?.topAgentsOrders?.length ? (
              stats.topAgentsOrders.map((a: any, idx: number) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold text-xs tabular-nums">
                      {idx + 1}
                    </div>
                    <p className="text-[13px] font-medium text-ink line-clamp-1">{a.name}</p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-ink-2">
                    {a.count} ped.
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted">No hay datos suficientes.</p>
            )}
          </div>
        </div>

        {/* Top 5 Agentes (Cobranza Efectivo) */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2 mb-6">
            <Banknote className="w-4 h-4 text-muted" />
            <h3 className="text-[15px] font-semibold text-ink">Top Agentes (Efectivo Recolectado)</h3>
          </div>
          <div className="space-y-4">
            {stats?.topAgentsCollections?.length ? (
              stats.topAgentsCollections.map((a: any, idx: number) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-semibold text-xs tabular-nums">
                      {idx + 1}
                    </div>
                    <p className="text-[13px] font-medium text-ink line-clamp-1">{a.name}</p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-ink-2">
                    {formatCurrency(a.total)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted">No hay datos suficientes.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
