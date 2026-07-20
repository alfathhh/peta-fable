import { useEffect, useState, type FormEvent } from 'react';
import { CalendarCheck, KeyRound } from 'lucide-react';
import { activityApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { Button, EmptyState, ErrorState, Input, LoadingState, PageHeader, Panel, StatusBadge } from '../components/ui';
import { toast } from '../stores/toastStore';
import { formatDateTime } from '../utils/format';
import type { MyActivity } from '../types';

export default function MyActivities() {
  const [activities, setActivities] = useState<MyActivity[] | null>(null);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(false);

  const load = () => { setError(false); activityApi.my().then(setActivities).catch(() => { setActivities([]); setError(true); }); };
  useEffect(() => {
    void load();
  }, []);

  async function claim(e: FormEvent) {
    e.preventDefault();
    setClaiming(true);
    try {
      const { activity } = await activityApi.claim(code.trim().toUpperCase());
      toast.success(`Berhasil klaim kegiatan "${activity.name}"`);
      setCode('');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="Area petugas" title="Kegiatan Saya" description="Klaim token dari admin untuk mulai mengerjakan proyek lapangan." />
      <Panel className="p-5 sm:p-6">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50"><KeyRound className="h-4 w-4 text-emerald-700" /></span> Klaim token kegiatan
        </h2>
        <p className="mb-4 text-sm text-stone-500">Masukkan kode 7 karakter yang diberikan admin.</p>
        <form onSubmit={claim} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="cth: A7K9M2X"
            maxLength={7}
            className="font-mono uppercase tracking-widest"
            required
          />
          <Button type="submit" className="sm:self-end" disabled={claiming || code.length !== 7}>
            {claiming ? 'Memproses...' : 'Klaim'}
          </Button>
        </form>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900"><CalendarCheck className="h-4 w-4 text-emerald-700" /> Riwayat kegiatan</h2>
        {activities === null ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : activities.length === 0 ? (
          <EmptyState text="Belum ada kegiatan. Klaim token dulu." />
        ) : (
          <ul className="divide-y">
            {activities.map((a) => {
              const expired = new Date(a.token_expires_at).getTime() < Date.now() || !a.token_is_active;
              return (
                <li key={a.activity_id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{a.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      Diklaim {formatDateTime(a.claimed_at)} · Token s.d. {formatDateTime(a.token_expires_at)}
                    </p>
                  </div>
                  <StatusBadge tone={expired ? 'neutral' : 'success'}>{expired ? 'Kedaluwarsa' : 'Aktif'}</StatusBadge>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
