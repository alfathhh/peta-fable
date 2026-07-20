import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  Database,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map,
  MapPinHouse,
  Menu,
  ScrollText,
  Tags,
  TicketCheck,
  Users,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { ToastContainer } from './ui';
import { ErrorBoundary } from './ErrorBoundary';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
  }`;

const adminGroups: [string, [string, string, LucideIcon][]][] = [
  ['Utama', [['/admin/dashboard', 'Dashboard', LayoutDashboard], ['/admin/infrastruktur', 'Infrastruktur', MapPinHouse], ['/admin/proyek', 'Proyek', FolderKanban]]],
  ['Kelola', [['/admin/pengguna', 'Pengguna', Users], ['/admin/kategori', 'Kategori', Tags], ['/admin/kegiatan', 'Kegiatan & Token', TicketCheck]]],
  ['Sistem', [['/admin/wilayah', 'Data Wilayah', Database], ['/admin/import-export', 'Import/Export', ArrowUpDown], ['/admin/audit', 'Audit Log', ScrollText]]],
];

const NavIcon = ({ icon: Icon }: { icon: LucideIcon }) => <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} />;

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = (
    <>
      <NavLink to="/" className={navClass} onClick={() => setMenuOpen(false)} end>
        <NavIcon icon={Map} /> Peta
      </NavLink>
      {user?.role === 'petugas' && (
        <>
          <NavLink to="/kegiatan" className={navClass} onClick={() => setMenuOpen(false)}>
            <NavIcon icon={KeyRound} /> Kegiatan Saya
          </NavLink>
          <NavLink to="/proyek" className={navClass} onClick={() => setMenuOpen(false)}>
            <NavIcon icon={FolderKanban} /> Proyek
          </NavLink>
        </>
      )}
      {user?.role === 'admin' && (
        <div className="space-y-4">
          {adminGroups.map(([group, items]) => (
            <div key={group}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-stone-400">{group}</p>
              <div className="space-y-1">{items.map(([to, label, Icon]) => <NavLink key={to} to={to} className={navClass} onClick={() => setMenuOpen(false)}><NavIcon icon={Icon} /> {label}</NavLink>)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  function exit() {
    logout();
    navigate('/login');
  }

  useEffect(() => {
    if (!menuOpen) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = prior; document.removeEventListener('keydown', close); };
  }, [menuOpen]);

  const brand = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
        <Waypoints className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 leading-tight">
        <h1 className="truncate text-sm font-semibold tracking-tight text-stone-900">Peta Tematik</h1>
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Padang Pariaman</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 bg-[#f4f5f2]">
      <ToastContainer />

      <aside className="relative z-10 hidden h-full w-56 shrink-0 flex-col border-r border-stone-200 bg-white shadow-[4px_0_18px_rgba(24,33,28,0.04)] lg:flex">
        <div className="flex h-16 items-center border-b border-stone-100 px-4">{brand}</div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">{links}</nav>
        <div className="border-t border-stone-100 p-3">
          <div className="mb-2 min-w-0 px-2">
            <p className="truncate text-xs font-medium text-stone-800">{user?.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{user?.role}</p>
          </div>
          <button onClick={exit} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-600">
            <LogOut className="h-[17px] w-[17px]" strokeWidth={1.75} /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-[1000] flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-3 lg:hidden">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100" onClick={() => setMenuOpen(true)} aria-label="Buka menu">
            <Menu className="h-5 w-5" />
          </button>
          {brand}
          <button onClick={exit} className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600" title="Keluar" aria-label="Keluar">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-[1400] flex lg:hidden">
            <button className="absolute inset-0 bg-stone-950/35 backdrop-blur-[1px]" onClick={() => setMenuOpen(false)} aria-label="Tutup menu" />
            <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-stone-100 px-4">
                {brand}
                <button className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">{links}</nav>
              <div className="border-t border-stone-100 p-3 text-xs text-stone-500">{user?.name} · {user?.role}</div>
            </aside>
          </div>
        )}

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
