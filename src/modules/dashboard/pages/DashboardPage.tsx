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
import { HeartPulse, Boxes } from 'lucide-react';

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
    { name: 'Stock Normal', value: normalStock, color: '#34d399' }, // Emerald 400
    { name: 'Bajo Stock', value: lowStock, color: '#fbbf24' },      // Amber 400
    { name: 'Agotados', value: outOfStock, color: '#f87171' },      // Red 400
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200/60 shadow-lg rounded-xl p-3 text-[13px]">
          <p className="font-semibold text-[#1D1D1F] mb-1">{label || payload[0].name}</p>
          <p className="text-[#0066CC] font-medium">
            {payload[0].value} unidades
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Salud del Inventario */}
        <div className="bg-white border border-gray-200/60 rounded-[24px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <HeartPulse className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Salud del Inventario</h3>
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
                  paddingAngle={5}
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
                  formatter={(value) => <span className="text-[13px] text-[#1D1D1F] font-medium ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Composición del Catálogo */}
        <div className="bg-white border border-gray-200/60 rounded-[24px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Boxes className="w-4 h-4 text-[#86868B]" />
            <h3 className="text-[14px] font-semibold text-[#1D1D1F]">Composición del Catálogo</h3>
          </div>

          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={catalogData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
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
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: '#F5F5F7' }}
                  content={<CustomTooltip />}
                />
                <Bar 
                  dataKey="valor" 
                  fill="#0066CC" 
                  radius={[6, 6, 6, 6]}
                  barSize={40}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
