import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Each navigation settles in from slightly below, without remounting the page.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    const page = pageRef.current;
    if (!page?.animate) return;
    const animation = page.animate(
      prefersReducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'none' },
          ],
      { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    return () => animation.cancel();
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas font-sans text-ink antialiased">
      <Sidebar
        isOpen={isSidebarOpen}
        isDesktopOpen={isDesktopSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onDesktopToggle={() => setIsDesktopSidebarOpen((open) => !open)}
      />
      <div
        ref={scrollRef}
        onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 4)}
        className="relative flex h-screen min-w-0 flex-1 flex-col overflow-auto"
      >
        <Header onMenuClick={() => setIsSidebarOpen(true)} isScrolled={isScrolled} />
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div ref={pageRef} className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
