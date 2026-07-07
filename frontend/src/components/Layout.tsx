import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Map, FolderKanban, KeyRound, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { ToastContainer } from './ui';
import { ErrorBoundary } from './ErrorBoundary';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`;

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = (
    <>
      <NavLink to="/" className={navClass} onClick={() => setMenuOpen(false)} end>
        <Map className="h-4 w-4" /> Peta
      </NavLink>
      {user?.role === 'petugas' && (
        <>
          <NavLink to="/kegiatan" className={navClass} onClick={() => setMenuOpen(false)}>
            <KeyRound className="h-4 w-4" /> Kegiatan Saya
          </NavLink>
          <NavLink to="/proyek" className={navClass} onClick={() => setMenuOpen(false)}>
            <FolderKanban className="h-4 w-4" /> Proyek
          </NavLink>
        </>
      )}
      {user?.role === 'admin' && (
        <>
          {[
            ['/admin/dashboard', 'Dashboard'],
            ['/admin/pengguna', 'Pengguna'],
            ['/admin/kategori', 'Kategori'],
            ['/admin/kegiatan', 'Kegiatan & Token'],
            ['/admin/infrastruktur', 'Infrastruktur'],
            ['/admin/proyek', 'Proyek'],
            ['/admin/wilayah', 'Data Wilayah'],
            ['/admin/import-export', 'Import/Export'],
            ['/admin/audit', 'Audit Log'],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} className={navClass} onClick={() => setMenuOpen(false)}>
              {label}
            </NavLink>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <ToastContainer />
      <header className="z-[1000] flex items-center justify-between border-b bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="rounded p-1.5 hover:bg-gray-100 lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-sm font-bold sm:text-base">Peta Tematik Padang Pariaman</h1>
        </div>
        <nav className="hidden items-center gap-1 lg:flex">{links}</nav>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-gray-500 sm:block">
            {user?.name} <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium uppercase">{user?.role}</span>
          </span>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav className="z-[1000] flex flex-col gap-1 border-b bg-white p-3 lg:hidden">{links}</nav>
      )}
      <main className="min-h-0 flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
