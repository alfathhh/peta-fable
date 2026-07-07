import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, FolderKanban, KeyRound, MapPinned, Users } from 'lucide-react';
import { dashboardApi } from '../../api/resources';
import { LoadingState } from '../../components/ui';
import { getCategoryIcon } from '../../config/categoryIcons';
import { formatDateTime } from '../../utils/format';
import type { DashboardData } from '../../types';

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ?? 'bg-blue-50 text-blue-600'}`}>
        {icon}
      </span>
      <div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function Bars({ items }: { items: { label: string; count: number; color?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="text-xs">
          <div className="mb-0.5 flex justify-between">
            <span>{i.label}</span>
            <span className="font-semibold">{i.count}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(i.count / max) * 100}%`, background: i.color ?? '#2563eb' }}
            />
          </div>
        </li>
      ))}
      {items.length === 0 && <p className="text-xs text-gray-400">Belum ada data.</p>}
    </ul>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    dashboardApi.get().then(setData).catch(() => {});
  }, []);

  if (!data) return <LoadingState text="Memuat dashboard..." />;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={<MapPinned className="h-5 w-5" />} label="Infrastruktur" value={data.totals.infrastructures} />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Menunggu ACC"
          value={data.totals.pending_approval}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Di luar wilayah proyek"
          value={data.totals.outside_region}
          accent="bg-red-50 text-red-500"
        />
        <StatCard icon={<FolderKanban className="h-5 w-5" />} label="Proyek aktif" value={data.totals.active_projects} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Pengguna aktif" value={data.totals.users} />
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Kegiatan" value={data.totals.activities} />
        <StatCard icon={<KeyRound className="h-5 w-5" />} label="Token aktif" value={data.totals.active_tokens} />
      </div>

      {data.totals.pending_approval > 0 && (
        <Link
          to="/admin/infrastruktur"
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          ⚠ {data.totals.pending_approval} infrastruktur menunggu ACC — klik untuk meninjau.
        </Link>
      )}

      <div className="grid gap-4 lg:grid--cols-2 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Per Kategori</h2>
          <Bars items={data.by_category.map((c) => ({ label: c!.name, count: c!.count, color: c!.color }))} />
        </section>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Per Kecamatan (10 terbanyak)</h2>
          <Bars items={data.by_kecamatan.map((k) => ({ label: k.name, count: k.count }))} />
        </section>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Terbaru</h2>
        <ul className="divide-y">
          {data.latest.map((i) => {
            const Icon = getCategoryIcon(i.category.icon);
            return (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: i.category.color }}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.name}</p>
                  <p className="text-xs text-gray-500">
                    {i.username} · {formatDateTime(i.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    i.approval_status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : i.approval_status === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {i.approval_status === 'approved' ? 'Di-ACC' : i.approval_status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
