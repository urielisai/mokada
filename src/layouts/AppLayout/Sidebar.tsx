import { useState } from 'react';
import { createPortal } from 'react-dom';
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
  Menu,
  PackageSearch,
  Receipt,
  Route,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Tags,
  Truck,
  UserRound,
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
  isDesktopOpen: boolean;
  onClose: () => void;
  onDesktopToggle: () => void;
}

export const Sidebar = ({ isOpen, isDesktopOpen, onClose, onDesktopToggle }: SidebarProps) => {
  const { isAdmin, profile } = useAuth();
  const canManageCustomers = isAdmin || profile?.user_type === 'AGENT';
  const [tooltip, setTooltip] = useState<{ label: string; left: number; top: number } | null>(null);

  const showTooltip = (label: string, element: HTMLElement) => {
    if (isDesktopOpen || !window.matchMedia('(min-width: 1024px)').matches) return;
    const bounds = element.getBoundingClientRect();
    setTooltip({ label, left: bounds.right + 10, top: bounds.top + bounds.height / 2 });
  };

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
          { path: '/admin/margins', label: 'Costos y ganancias', icon: Wallet },
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
          { path: '/route-operations/roles', label: 'Roles de Rutas', icon: ClipboardCheck },
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
          { path: '/orders', label: isAdmin ? 'Pedidos' : 'Mis Pedidos', icon: ShoppingCart },
          ...(!isAdmin ? [{ path: '/orders/paid', label: 'Pedidos pagados', icon: ClipboardCheck }] : []),
          ...(isAdmin ? [{ path: '/orders/warranties', label: 'Pedidos en garantía', icon: ShieldCheck }] : []),
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
      <button
        type="button"
        aria-label="Cerrar menu"
        tabIndex={isOpen ? 0 : -1}
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        id="main-sidebar"
        onMouseLeave={() => setTooltip(null)}
        className={`material-sidebar fixed inset-y-0 left-0 z-40 flex h-full w-[264px] shrink-0 flex-col shadow-[0.5px_0_0_rgb(0_0_0/0.08)] transition-[translate,width] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] max-lg:shadow-2xl lg:static lg:translate-x-0 ${isDesktopOpen ? 'lg:w-[264px]' : 'lg:w-[72px]'} ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`flex h-[3.25rem] shrink-0 items-center justify-between px-5 ${isDesktopOpen ? '' : 'lg:justify-center lg:px-2'}`}>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Mokada" className={`h-6 w-auto ${isDesktopOpen ? '' : 'lg:hidden'}`} />
          </div>
          <button
            type="button"
            onClick={onDesktopToggle}
            aria-controls="main-sidebar"
            aria-expanded={isDesktopOpen}
            aria-label={isDesktopOpen ? 'Comprimir menú lateral' : 'Expandir menú lateral'}
            title={isDesktopOpen ? 'Comprimir menú' : 'Expandir menú'}
            className="hidden h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-black/[0.06] lg:flex"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-muted hover:bg-black/[0.08] hover:text-ink lg:hidden"
            title="Cerrar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-6 pt-1" onScroll={() => setTooltip(null)}>
          <nav className={`space-y-5 ${isDesktopOpen ? '' : 'lg:space-y-2'}`}>
            {sections.map((section, idx) => (
              <div key={`${section.label || section.path}-${idx}`} className={`px-3 ${isDesktopOpen ? '' : `lg:px-2 ${idx > 0 ? 'lg:border-t lg:border-black/[0.06] lg:pt-2' : ''}`}`}>
                {section.items ? (
                  <>
                    <h3 className={`px-3 pb-1 text-[11px] font-semibold tracking-[0.01em] text-gray-500 ${isDesktopOpen ? '' : 'lg:sr-only'}`}>
                      {section.label}
                    </h3>
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <NavItem key={item.path} item={item} isDesktopOpen={isDesktopOpen} onNavigate={onClose} onTooltip={showTooltip} onTooltipHide={() => setTooltip(null)} />
                      ))}
                    </div>
                  </>
                ) : (
                  <NavItem item={section as NavItemConfig} isDesktopOpen={isDesktopOpen} onNavigate={onClose} onTooltip={showTooltip} onTooltipHide={() => setTooltip(null)} />
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>
      {!isDesktopOpen && tooltip && createPortal(
        <div
          role="tooltip"
          className="material-dark pointer-events-none fixed z-50 -translate-y-1/2 animate-pop-in rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.label}
        </div>,
        document.body
      )}
    </>
  );
};

const NavItem = ({ item, isDesktopOpen, onNavigate, onTooltip, onTooltipHide }: {
  item: NavItemConfig;
  isDesktopOpen: boolean;
  onNavigate: () => void;
  onTooltip: (label: string, element: HTMLElement) => void;
  onTooltipHide: () => void;
}) => {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] text-gray-400">
        <Icon className="h-4 w-4" />
        {item.label}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/orders' || item.path === '/'}
      onClick={() => {
        onTooltipHide();
        onNavigate();
      }}
      onMouseEnter={(event) => onTooltip(item.label, event.currentTarget)}
      onMouseLeave={onTooltipHide}
      onFocus={(event) => onTooltip(item.label, event.currentTarget)}
      onBlur={onTooltipHide}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-[9px] px-3 py-[7px] text-[13px] ${isDesktopOpen ? '' : 'lg:h-10 lg:justify-center lg:px-0'} ${
          isActive
            ? 'bg-white font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_0.5px_rgb(0_0_0/0.06)]'
            : 'text-ink-2 hover:bg-black/[0.05] hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-[17px] w-[17px] shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-gray-500 group-hover:text-ink-2'}`}
            strokeWidth={1.9}
          />
          <span className={`truncate ${isDesktopOpen ? '' : 'lg:sr-only'}`}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
};
