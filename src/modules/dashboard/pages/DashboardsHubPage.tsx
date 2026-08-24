import { useState } from 'react';
import { useAuth } from '../../auth/context/useAuth';
import { DashboardPage } from './DashboardPage';
import { RouteOpsDashboardPage } from '../../route-operations/pages/RouteOpsDashboardPage';
import { OrdersDashboardPage } from '../../orders/pages/OrdersDashboardPage';
import { LayoutDashboard, Route, ShoppingCart } from 'lucide-react';
import { Navigate } from 'react-router-dom';

type TabId = 'main' | 'orders' | 'routes';

export const DashboardsHubPage = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('main');

  if (!isAdmin) {
    return <Navigate to="/my-route" replace />;
  }

  const tabs = [
    { id: 'main', label: 'Principal', icon: LayoutDashboard },
    { id: 'orders', label: 'Ventas', icon: ShoppingCart },
    { id: 'routes', label: 'Rutas', icon: Route },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Análisis y Métricas</h2>
          <p className="text-[15px] text-[#86868B] mt-1">Control integral del rendimiento del negocio</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl w-full sm:w-fit border border-gray-200/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white text-[#1D1D1F] shadow-sm ring-1 ring-black/5'
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'main' && <DashboardPage />}
        {activeTab === 'orders' && <OrdersDashboardPage />}
        {activeTab === 'routes' && <RouteOpsDashboardPage />}
      </div>
    </div>
  );
};
