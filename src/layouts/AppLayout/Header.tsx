import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { NotificationBell } from '../../modules/notifications/NotificationBell';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useAuth } from '../../modules/auth/context/useAuth';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <header className="sticky top-0 z-20 flex h-[3.25rem] items-center justify-between border-b border-gray-200/50 bg-white/80 px-3 backdrop-blur-md sm:px-6">
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-controls="main-sidebar"
          aria-label="Abrir menú lateral"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#424245] transition-colors hover:bg-gray-100 lg:hidden"
          title="Abrir menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        {/* Search could go here in the future */}
      </div>
      
      <div className="flex items-center gap-2 text-gray-500 sm:gap-3">
        <NotificationBell />
        
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="flex max-w-[220px] items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-medium text-[#1D1D1F]">{fullName}</p>
              <p className="truncate text-[11px] text-[#86868B]">{profile?.email}</p>
            </div>
            <UserAvatar
              firstName={profile?.first_name}
              lastName={profile?.last_name}
              avatarPath={profile?.avatar_path}
              className="h-8 w-8"
              imageClassName="h-8 w-8 rounded-full object-cover"
            />
            <ChevronDown className="hidden h-4 w-4 text-[#86868B] sm:block" />
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-gray-100 p-4">
                <UserAvatar
                  firstName={profile?.first_name}
                  lastName={profile?.last_name}
                  avatarPath={profile?.avatar_path}
                  className="h-12 w-12 text-sm"
                  imageClassName="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1D1D1F]">{fullName}</p>
                  <p className="truncate text-[12px] text-[#86868B]">{profile?.email}</p>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
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
