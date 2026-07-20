import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { activityApi, downloadBlob, projectApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { Button, EmptyState, ErrorState, IconButton, Input, LoadingState, Modal, PageHeader, Panel, Select, StatusBadge } from '../components/ui';
import { RegionCascade } from '../components/filters/RegionCascade';
import { toast } from '../stores/toastStore';
import { formatDate } from '../utils/format';
import type { MyActivity, Project } from '../types';

export default function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [activityId, setActivityId] = useState('');
  const [region, setRegion] = useState<{ region_id: string; level: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const load = () => { setError(false); projectApi.my().then(setProjects).catch(() => { setProjects([]); setError(true); }); };
  useEffect(() => {
    void load();
    activityApi
      .my()
      .then((a) => setActivities(a.filter((x) => x.token_is_active && new Date(x.token_expires_at).getTime() > Date.now())))
      .catch(() => {});
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!region) return;
    setSaving(true);
    try {
      await projectApi.create({ name, activity_id: activityId, region_id: region.region_id });
      toast.success('Proyek dibuat');
      setOpen(false);
      setName('');
      setActivityId('');
      setRegion(null);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Hapus proyek "${p.name}"?`)) return;
    try {
      await projectApi.remove(p.id);
      toast.success('Proyek dihapus');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="Area petugas" title="Proyek Saya" description="Buka wilayah kerja dan kelola pendataan infrastruktur." actions={<>
          <Button
            variant="secondary"
            onClick={() => downloadBlob('/my/export/infrastructures', { format: 'xlsx' }).catch(() => toast.error('Gagal export'))}
            title="Unduh semua infrastruktur yang Anda input (XLSX)"
          >
            <Download className="h-4 w-4" /> Export Data Saya
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Proyek Baru
          </Button>
      </>} />

      {projects === null ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : projects.length === 0 ? (
        <EmptyState text="Belum ada proyek. Buat proyek baru untuk mulai mendata." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Panel className="group flex h-full items-start gap-3 p-4 transition hover:border-emerald-200 hover:shadow-md">
              <Link to={`/proyek/${p.id}`} className="min-w-0 flex-1 py-1">
                <div className="mb-3 flex items-center justify-between gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50"><FolderKanban className="h-4 w-4 text-emerald-700" /></span><StatusBadge tone="info">{p._count?.infrastructures ?? 0} titik</StatusBadge></div>
                <p className="truncate text-sm font-semibold text-stone-900 group-hover:text-emerald-800">{p.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  {p.activity?.name} · {p.region_name} ({p.regionLevel}) · dibuat {formatDate(p.createdAt)}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {p._count?.infrastructures ?? 0} infrastruktur · {p._count?.layers ?? 0} layer
                </p>
              </Link>
              <IconButton label={`Hapus ${p.name}`} variant="danger" onClick={() => void remove(p)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Buat Proyek Baru">
        <form onSubmit={create} className="space-y-3">
          <Input label="Nama proyek" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select label="Kegiatan (hasil klaim token)" value={activityId} onChange={(e) => setActivityId(e.target.value)} required>
            <option value="">— Pilih kegiatan —</option>
            {activities.map((a) => (
              <option key={a.activity_id} value={a.activity_id}>
                {a.name}
              </option>
            ))}
          </Select>
          {activities.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Belum ada kegiatan aktif. <Link to="/kegiatan" className="font-semibold underline">Klaim token kegiatan dulu</Link>.</div>}
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Wilayah proyek</p>
            <p className="mb-2 text-xs text-gray-500">
              Pilih tepat satu kecamatan, desa/nagari, SLS, atau sub-SLS sebagai wilayah proyek.
            </p>
            <RegionCascade minLevel="kec" onChange={setRegion} />
            {region && (
              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                Terpilih: {region.name} ({region.region_id})
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={saving || !name || !activityId || !region}>
            {saving ? 'Menyimpan...' : 'Simpan Proyek'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
