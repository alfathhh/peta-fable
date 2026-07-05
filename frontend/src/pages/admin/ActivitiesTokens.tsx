import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { activityApi, tokenApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, Input, LoadingState, Modal, Select, Textarea } from '../../components/ui';
import { toast } from '../../stores/toastStore';
import { formatDateTime } from '../../utils/format';
import type { Activity, ActivityToken } from '../../types';

export default function AdminActivitiesTokens() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [tokens, setTokens] = useState<ActivityToken[]>([]);
  const [actOpen, setActOpen] = useState(false);
  const [tokOpen, setTokOpen] = useState(false);
  const [actForm, setActForm] = useState({ name: '', description: '' });
  const [tokForm, setTokForm] = useState({ activity_id: '', expires_at: '', max_claims: '' });
  const [createdToken, setCreatedToken] = useState<ActivityToken | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    activityApi.adminList().then(setActivities).catch(() => setActivities([]));
    tokenApi.list().then(setTokens).catch(() => {});
  };
  useEffect(() => {
    void load();
  }, []);

  async function createActivity(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await activityApi.adminCreate({ name: actForm.name, description: actForm.description || undefined });
      toast.success('Kegiatan dibuat');
      setActOpen(false);
      setActForm({ name: '', description: '' });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeActivity(a: Activity) {
    if (!confirm(`Hapus kegiatan "${a.name}"? Token & klaim terkait ikut terhapus.`)) return;
    try {
      await activityApi.adminRemove(a.id);
      toast.success('Kegiatan dihapus');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function createToken(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await tokenApi.create({
        activity_id: tokForm.activity_id,
        expires_at: new Date(tokForm.expires_at).toISOString(),
        max_claims: tokForm.max_claims ? Number(tokForm.max_claims) : null,
      });
      setCreatedToken(created);
      setTokOpen(false);
      setTokForm({ activity_id: '', expires_at: '', max_claims: '' });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleToken(t: ActivityToken) {
    try {
      await tokenApi.update(t.id, { is_active: !t.isActive });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function removeToken(t: ActivityToken) {
    if (!confirm(`Hapus token ${t.token}?`)) return;
    try {
      await tokenApi.remove(t.id);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Kegiatan</h1>
          <Button onClick={() => setActOpen(true)}>
            <Plus className="h-4 w-4" /> Kegiatan Baru
          </Button>
        </div>
        {activities === null ? (
          <LoadingState />
        ) : (
          <ul className="space-y-2">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-500">
                    {a.description ?? '—'} · {a._count?.tokens ?? 0} token · {a._count?.projects ?? 0} proyek
                  </p>
                </div>
                <button onClick={() => void removeActivity(a)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Token Kegiatan</h2>
          <Button onClick={() => setTokOpen(true)} disabled={!activities?.length}>
            <Plus className="h-4 w-4" /> Generate Token
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Kegiatan</th>
                <th className="px-4 py-3">Kedaluwarsa</th>
                <th className="px-4 py-3">Klaim</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tokens.map((t) => {
                const expired = new Date(t.expiresAt).getTime() < Date.now();
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold tracking-widest">{t.token}</span>
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(t.token);
                          toast.success('Token disalin');
                        }}
                        className="ml-1 rounded p-1 text-gray-400 hover:text-blue-600"
                        title="Salin"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-3">{t.activity?.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(t.expiresAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      {t.claimsCount}
                      {t.maxClaims ? ` / ${t.maxClaims}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void toggleToken(t)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          expired
                            ? 'bg-gray-100 text-gray-500'
                            : t.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {expired ? 'Kedaluwarsa' : t.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => void removeToken(t)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={actOpen} onClose={() => setActOpen(false)} title="Kegiatan Baru">
        <form onSubmit={createActivity} className="space-y-3">
          <Input label="Nama kegiatan" value={actForm.name} onChange={(e) => setActForm({ ...actForm, name: e.target.value })} required />
          <Textarea label="Deskripsi (opsional)" value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
          <Button type="submit" className="w-full" disabled={saving}>
            Simpan
          </Button>
        </form>
      </Modal>

      <Modal open={tokOpen} onClose={() => setTokOpen(false)} title="Generate Token">
        <form onSubmit={createToken} className="space-y-3">
          <Select label="Kegiatan" value={tokForm.activity_id} onChange={(e) => setTokForm({ ...tokForm, activity_id: e.target.value })} required>
            <option value="">— Pilih kegiatan —</option>
            {(activities ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input label="Kedaluwarsa" type="datetime-local" value={tokForm.expires_at} onChange={(e) => setTokForm({ ...tokForm, expires_at: e.target.value })} required />
          <Input label="Batas pemakaian (kosong = tak terbatas)" type="number" min={1} value={tokForm.max_claims} onChange={(e) => setTokForm({ ...tokForm, max_claims: e.target.value })} />
          <Button type="submit" className="w-full" disabled={saving || !tokForm.activity_id || !tokForm.expires_at}>
            Generate
          </Button>
        </form>
      </Modal>

      <Modal open={!!createdToken} onClose={() => setCreatedToken(null)} title="Token Berhasil Dibuat">
        {createdToken && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-500">Bagikan token ini ke petugas ({createdToken.activity?.name}):</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">{createdToken.token}</p>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(createdToken.token);
                toast.success('Token disalin');
              }}
              className="w-full"
            >
              <Copy className="h-4 w-4" /> Salin Token
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
