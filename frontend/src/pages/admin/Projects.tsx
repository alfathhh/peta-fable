import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { projectApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, Select } from '../../components/ui';
import { toast } from '../../stores/toastStore';
import { formatDate } from '../../utils/format';
import type { Project } from '../../types';

export default function AdminProjects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [statusEdit, setStatusEdit] = useState<Record<string, string>>({});

  const load = () => projectApi.adminList().then(setProjects).catch(() => setProjects([]));
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(p: Project, status: string) {
    setStatusEdit((s) => ({ ...s, [p.id]: status }));
    try {
      await projectApi.adminUpdate(p.id, { status });
      toast.success('Status diperbarui');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Hapus proyek "${p.name}" milik ${p.user?.username}?`)) return;
    try {
      await projectApi.adminRemove(p.id);
      toast.success('Proyek dihapus');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Semua Proyek</h1>
      {projects === null ? (
        <LoadingState />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Proyek</th>
                <th className="px-4 py-3">Petugas</th>
                <th className="px-4 py-3">Kegiatan</th>
                <th className="px-4 py-3">Wilayah</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">dibuat {formatDate(p.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{p.user?.username}</td>
                  <td className="px-4 py-3 text-xs">{p.activity?.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {p.region_name}
                    <span className="ml-1 uppercase text-gray-400">({p.regionLevel})</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p._count?.infrastructures ?? 0} infra · {p._count?.layers ?? 0} layer
                  </td>
                  <td className="px-4 py-3">
                    <Select value={statusEdit[p.id] ?? p.status} onChange={(e) => void setStatus(p, e.target.value)} className="!py-1 text-xs">
                      <option value="aktif">aktif</option>
                      <option value="selesai">selesai</option>
                      <option value="arsip">arsip</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => void remove(p)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
