import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { activityApi, downloadBlob, projectApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { Button, EmptyState, Input, LoadingState, Modal, Select } from '../components/ui';
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

  const load = () => projectApi.my().then(setProjects).catch(() => setProjects([]));
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
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <FolderKanban className="h-5 w-5 text-blue-600" /> Proyek Saya
        </h1>
        <div className="flex gap-2">
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
        </div>
      </div>

      {projects === null ? (
        <LoadingState />
      ) : projects.length === 0 ? (
        <EmptyState text="Belum ada proyek. Buat proyek baru untuk mulai mendata." />
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
              <Link to={`/proyek/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-blue-700 hover:underline">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.activity?.name} · {p.region_name} ({p.regionLevel}) · dibuat {formatDate(p.createdAt)}
                </p>
                <p className="text-xs text-gray-400">
                  {p._count?.infrastructures ?? 0} infrastruktur · {p._count?.layers ?? 0} layer
                </p>
              </Link>
              <button onClick={() => void remove(p)} className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Hapus">
                <Trash2 className="h-4 w-4" />
              </button>
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
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Wilayah proyek</p>
            <p className="mb-2 text-xs text-gray-500">
              Kecamatan hanya untuk mempersempit — wilayah proyek minimal level desa/nagari.
            </p>
            <RegionCascade minLevel="desa" onChange={setRegion} />
            {region && (
              <p className="mt-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
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
