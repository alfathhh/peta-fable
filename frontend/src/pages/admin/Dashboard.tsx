import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, FolderKanban, KeyRound, MapPinOff, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { dashboardApi } from '../../api/resources';
import { Button, ErrorState, LoadingState, StatusBadge } from '../../components/ui';
import { getCategoryIcon } from '../../config/categoryIcons';
import { formatDateTime } from '../../utils/format';
import type { DashboardData } from '../../types';

function Kpi({ icon, label, value, note, tone = 'emerald' }: { icon: React.ReactNode; label: string; value: number; note: string; tone?: 'emerald' | 'amber' | 'red' | 'blue' }) {
  const colors = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700' };
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</div><p className="text-3xl font-semibold tracking-tight text-stone-950">{value}</p><p className="mt-1 text-sm font-semibold text-stone-800">{label}</p><p className="mt-1 text-xs text-stone-500">{note}</p></div>;
}

function CategoryComposition({ items, total }: { items: DashboardData['by_category']; total: number }) {
  return <ul className="grid gap-2 sm:grid-cols-2">{items.map((item) => { const Icon = getCategoryIcon(item.icon); const share = total ? Math.round(item.count / total * 100) : 0; return <li key={item.category_id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: item.color }}><Icon className="h-[18px] w-[18px]" strokeWidth={2.3} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-stone-800">{item.name}</p><p className="text-xs text-stone-500">{item.count} titik · {share}%</p></div></li>; })}</ul>;
}

function RegionCoverage({ items, covered, total }: { items: DashboardData['by_kecamatan']; covered: number; total: number }) {
  const rate = total ? Math.round(covered / total * 100) : 0;
  return <><div className="rounded-xl bg-emerald-50 p-4"><div className="flex items-end justify-between"><div><strong className="text-2xl text-emerald-900">{covered}/{total}</strong><p className="text-xs text-emerald-700">kecamatan memiliki data disetujui</p></div><strong className="text-sm text-emerald-800">{rate}%</strong></div><div className="mt-3 h-2 rounded-full bg-emerald-100"><div className="h-2 rounded-full bg-emerald-700" style={{ width: `${rate}%` }} /></div></div><ol className="mt-4 space-y-2">{items.map((item, index) => <li key={item.region_id} className="flex items-center gap-3 text-sm"><span className="w-5 text-xs text-stone-400">{index + 1}</span><span className="flex-1 font-medium text-stone-700">{item.name}</span><span className="text-stone-500">{item.count} titik</span></li>)}</ol></>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => { setError(false); dashboardApi.get().then(setData).catch(() => setError(true)); }, []);
  useEffect(load, [load]);
  if (error) return <div className="p-6"><ErrorState text="Dashboard gagal dimuat." onRetry={load} /></div>;
  if (!data) return <LoadingState text="Memuat dashboard..." />;
  const outsideRate = data.totals.infrastructures ? Math.round(data.totals.outside_region / data.totals.infrastructures * 100) : 0;

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Kondisi data saat ini</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Dashboard</h1><p className="mt-1 text-sm text-stone-500">Prioritas review, kualitas lokasi, dan aktivitas pendataan.</p></div><Button variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Segarkan</Button></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Dipublikasikan" value={data.totals.approved} note={`${data.totals.infrastructures} total data`} />
      <Kpi icon={<Clock3 className="h-5 w-5" />} label="Perlu ditinjau" value={data.totals.pending_approval} note="Menunggu keputusan admin" tone="amber" />
      <Kpi icon={<MapPinOff className="h-5 w-5" />} label="Di luar wilayah" value={data.totals.outside_region} note={`${outsideRate}% dari seluruh data`} tone="red" />
      <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Ditambahkan 7 hari" value={data.totals.added_7d} note="Laju pendataan terbaru" tone="blue" />
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      {data.totals.pending_approval > 0 && <Link to="/admin/infrastruktur?approval_status=pending" className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"><span>{data.totals.pending_approval} data perlu ditinjau sekarang</span><span>Review →</span></Link>}
      {data.totals.outside_region > 0 && <Link to="/admin/infrastruktur?is_outside_region=true" className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"><span>Audit {data.totals.outside_region} titik di luar wilayah</span><span>Lihat →</span></Link>}
      {data.totals.added_7d === 0 && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Belum ada pendataan baru dalam 7 hari terakhir.</div>}
    </div>

    <section className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-stone-500" /><div><strong>{data.totals.active_officers}</strong><p className="text-xs text-stone-500">Petugas aktif</p></div></div><div className="flex items-center gap-3"><FolderKanban className="h-5 w-5 text-stone-500" /><div><strong>{data.totals.active_projects}</strong><p className="text-xs text-stone-500">Proyek aktif</p></div></div><div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-stone-500" /><div><strong>{data.totals.active_tokens}</strong><p className="text-xs text-stone-500">Token masih berlaku</p></div></div></section>

    <div className="grid gap-4 xl:grid-cols-2"><section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-stone-900">Komposisi kategori</h2><p className="mb-4 mt-1 text-xs text-stone-500">Porsi dari {data.totals.approved} data yang sudah disetujui.</p><CategoryComposition items={data.by_category} total={data.totals.approved} /></section><section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-stone-900">Cakupan kecamatan</h2><p className="mb-4 mt-1 text-xs text-stone-500">Proporsi kecamatan yang sudah memiliki data disetujui.</p><RegionCoverage items={data.by_kecamatan} covered={data.coverage.covered_kecamatan} total={data.coverage.total_kecamatan} /></section></div>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="mb-3 text-sm font-semibold">Aktivitas terbaru</h2><ul className="divide-y divide-stone-100">{data.latest.map((item) => { const Icon = getCategoryIcon(item.category.icon); return <li key={item.id} className="flex items-center gap-3 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: item.category.color }}><Icon className="h-[18px] w-[18px]" strokeWidth={2.3} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-stone-500">@{item.username} · {formatDateTime(item.created_at)}</p></div><StatusBadge tone={item.approval_status === 'approved' ? 'success' : item.approval_status === 'rejected' ? 'danger' : 'warning'}>{item.approval_status === 'approved' ? 'Disetujui' : item.approval_status === 'rejected' ? 'Ditolak' : 'Menunggu'}</StatusBadge></li>; })}</ul></section>
  </div>;
}
