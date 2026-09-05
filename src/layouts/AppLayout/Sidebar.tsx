import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.svg';
import {
  ArrowRightLeft,
  Boxes,
  Building2,
  CarFront,
  ClipboardCheck,
  Handshake,
  LayoutDashboard,
  ListTree,
  MapPin,
  PackageSearch,
  Receipt,
  Route,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../modules/auth/context/useAuth';

interface NavItemConfig {
  path: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface NavSection {
  label?: string;
  items?: NavItemConfig[];
  path?: string;
  icon?: LucideIcon;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { isAdmin, profile } = useAuth();
  const canManageCustomers = isAdmin || profile?.user_type === 'AGENT';

  const getNavSections = (): NavSection[] => {
    const sections: NavSection[] = [];

    if (isAdmin) {
      sections.push({ path: '/', label: 'Análisis y Métricas', icon: LayoutDashboard });
    }

    sections.push({
      label: 'Catalogo',
      items: [
        { path: '/catalog/products', label: 'Productos', icon: PackageSearch },
        ...(isAdmin
          ? [
              { path: '/catalog/categories', label: 'Categorias', icon: ListTree },
              { path: '/catalog/brands', label: 'Marcas', icon: Tags },
              { path: '/catalog/vehicles', label: 'Vehiculos', icon: CarFront },
            ]
          : []),
      ],
    });

    if (canManageCustomers) {
      sections.push({
        label: 'Comercial',
        items: [
          { path: '/customers', label: 'Clientes', icon: Handshake },
          ...(isAdmin ? [{ path: '/admin/debts', label: 'Adeudos y Crédito', icon: Wallet }] : []),
        ],
      });
    }

    if (isAdmin) {
      sections.push({
        label: 'Inventario',
        items: [
          { path: '/inventory/stock', label: 'Existencias', icon: Boxes },
          { path: '/inventory/movements', label: 'Movimientos', icon: ArrowRightLeft },
          { path: '/inventory/transfers', label: 'Traspasos', icon: Truck },
          { path: '/inventory/warehouses', label: 'Almacenes', icon: Building2 },
        ],
      });

      sections.push({
        label: 'Operacion en Ruta',
        items: [
          { path: '/fleet/vehicles', label: 'Flotilla', icon: Truck },
          { path: '/fleet/expenses', label: 'Gastos Vehiculares', icon: Receipt },
          { path: '/route-operations/routes', label: 'Rutas', icon: Route },
          { path: '/route-operations/trips', label: 'Viajes Semanales', icon: MapPin },
          { path: '/route-operations/settlements', label: 'Conciliacion', icon: ClipboardCheck },
        ],
      });

      sections.push({
        path: '/config',
        label: 'Configuracion',
        icon: Settings,
      });
    }

    if (isAdmin || profile?.user_type === 'AGENT') {
      sections.push({
        label: 'Ventas',
        items: [
          { path: '/orders', label: 'Pedidos', icon: ShoppingCart },
        ],
      });
    }

    if (profile?.user_type === 'AGENT') {
      sections.push({
        label: 'Mi Ruta',
        items: [
          { path: '/my-route', label: 'Ruta Actual', icon: MapPin },
          { path: '/route-operations/debts', label: 'Cobranza de Ruta', icon: Wallet },
          { path: '/fleet/expenses', label: 'Gastos Vehiculares', icon: Receipt },
        ],
      });
    }

    if (profile?.user_type === 'CUSTOMER') {
      sections.push({
        label: 'Mis Compras',
        items: [
          { path: '/my-orders', label: 'Mis Pedidos', icon: ShoppingCart },
          { path: '/my-debts', label: 'Mis Adeudos', icon: Wallet },
        ],
      });
    }

    sections.push({
      label: 'Cuenta',
      items: [{ path: '/account/profile', label: 'Mi perfil', icon: UserRound }],
    });

    return sections;
  };

  const sections = getNavSections();

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Cerrar menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-[260px] flex-col border-r border-gray-200/50 bg-[#F5F5F7] transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[3.25rem] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Mokada" className="h-6 w-auto" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#86868B] transition-colors hover:bg-black/5 hover:text-[#1D1D1F] lg:hidden"
            title="Cerrar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <nav className="space-y-4">
            {sections.map((section, idx) => (
              <div key={`${section.label || section.path}-${idx}`} className="px-3">
                {section.items ? (
                  <>
                    <h3 className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                      {section.label}
                    </h3>
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <NavItem key={item.path} item={item} onNavigate={onClose} />
                      ))}
                    </div>
                  </>
                ) : (
                  <NavItem item={section as NavItemConfig} onNavigate={onClose} />
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};

const NavItem = ({ item, onNavigate }: { item: NavItemConfig; onNavigate: () => void }) => {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-gray-400">
        <Icon className="h-4 w-4" />
        {item.label}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/orders' || item.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
          isActive ? 'bg-[#0066CC] font-medium text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/5'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </NavLink>
  );
};
