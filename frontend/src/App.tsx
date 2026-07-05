import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/Layout';
import { LoadingState } from './components/ui';
import Login from './pages/Login';
import MapHome from './pages/MapHome';

// Halaman selain peta di-lazy-load (performa — ARCHITECTURE §9)
const MyActivities = lazy(() => import('./pages/MyActivities'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminActivitiesTokens = lazy(() => import('./pages/admin/ActivitiesTokens'));
const AdminInfrastructures = lazy(() => import('./pages/admin/Infrastructures'));
const AdminProjects = lazy(() => import('./pages/admin/Projects'));
const AdminRegionUpload = lazy(() => import('./pages/admin/RegionUpload'));
const AdminImportExport = lazy(() => import('./pages/admin/ImportExport'));

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<MapHome />} />
          <Route
            path="kegiatan"
            element={
              <Suspense fallback={<LoadingState />}>
                <MyActivities />
              </Suspense>
            }
          />
          <Route
            path="proyek"
            element={
              <Suspense fallback={<LoadingState />}>
                <Projects />
              </Suspense>
            }
          />
          <Route
            path="proyek/:id"
            element={
              <Suspense fallback={<LoadingState />}>
                <ProjectDetail />
              </Suspense>
            }
          />
          {(
            [
              ['admin/pengguna', AdminUsers],
              ['admin/kategori', AdminCategories],
              ['admin/kegiatan', AdminActivitiesTokens],
              ['admin/infrastruktur', AdminInfrastructures],
              ['admin/proyek', AdminProjects],
              ['admin/wilayah', AdminRegionUpload],
              ['admin/import-export', AdminImportExport],
            ] as const
          ).map(([path, Component]) => (
            <Route
              key={path}
              path={path}
              element={
                <RequireAdmin>
                  <Suspense fallback={<LoadingState />}>
                    <Component />
                  </Suspense>
                </RequireAdmin>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
