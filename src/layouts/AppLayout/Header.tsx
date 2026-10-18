import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresence } from '../../hooks/usePresence';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { NotificationBell } from '../../modules/notifications/NotificationBell';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useAuth } from '../../modules/auth/context/useAuth';
import { useRouteScope } from '../../modules/route-operations/hooks/useRouteScope';

interface HeaderProps {
  onMenuClick: () => void;
  isScrolled?: boolean;
}

export const Header = ({ onMenuClick, isScrolled = false }: HeaderProps) => {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { routeOptions, selectedRouteId, setSelectedRouteId, isLoading: isLoadingRoutes } = useRouteScope();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuPresence = usePresence(isMenuOpen, 180);
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario';

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header
      className={`material-chrome sticky top-0 z-20 flex h-[3.25rem] shrink-0 items-center justify-between px-3 transition-[box-shadow] duration-200 sm:px-6 ${
        isScrolled ? 'shadow-[0_0.5px_0_rgb(0_0_0/0.12)]' : 'shadow-[0_0.5px_0_rgb(0_0_0/0.04)]'
      }`}
    >
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-controls="main-sidebar"
          aria-label="Abrir menú lateral"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-black/5 lg:hidden"
          title="Abrir menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        {/* Search could go here in the future */}
      </div>
      
      <div className="flex items-center gap-1.5 text-gray-500 sm:gap-2.5">
        {!isAdmin && routeOptions.length <= 1 ? (
          !isLoadingRoutes && (
            <div className="hidden sm:flex h-8 items-center rounded-full bg-black/[0.05] px-3.5 text-[13px] font-medium text-ink">
              {routeOptions[0]?.name ?? 'Sin rutas asignadas'}
            </div>
          )
        ) : (
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            aria-label="Filtrar por ruta"
            className="h-8 max-w-[140px] sm:max-w-[200px] rounded-full border border-transparent bg-black/[0.05] pl-3 sm:pl-3.5 text-[12px] sm:text-[13px] font-medium text-ink outline-none hover:bg-black/[0.08] focus:border-accent/50 focus:bg-white focus:ring-4 focus:ring-accent/15"
          >
            <option value="">{isAdmin ? 'Todas las rutas' : 'Todas mis rutas'}</option>
            {routeOptions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        <NotificationBell />
        
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="flex max-w-[240px] items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-black/5 sm:pl-3 sm:pr-1.5"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-medium text-ink">{fullName}</p>
              <p className="truncate text-[11px] text-muted">{profile?.email}</p>
            </div>
            <UserAvatar
              firstName={profile?.first_name}
              lastName={profile?.last_name}
              avatarPath={profile?.avatar_path}
              className="h-8 w-8"
              imageClassName="h-8 w-8 rounded-full object-cover"
            />
            <ChevronDown className={`hidden h-4 w-4 text-muted transition-transform duration-200 sm:block ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuPresence.isMounted && (
            <div
              role="menu"
              data-state={menuPresence.state}
              className={`overlay-popover material-popover absolute right-0 mt-2 w-[min(22rem,calc(100vw-1rem))] origin-top-right overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/[0.06] ${isMenuOpen ? '' : 'pointer-events-none'}`}
            >
              <div className="flex items-center gap-3 border-b border-black/[0.06] p-4">
                <UserAvatar
                  firstName={profile?.first_name}
                  lastName={profile?.last_name}
                  avatarPath={profile?.avatar_path}
                  className="h-12 w-12 text-sm"
                  imageClassName="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
                  <p className="truncate text-[12px] text-muted">{profile?.email}</p>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-500/10"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
