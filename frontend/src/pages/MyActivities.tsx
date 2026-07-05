import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { activityApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { Button, EmptyState, Input, LoadingState } from '../components/ui';
import { toast } from '../stores/toastStore';
import { formatDateTime } from '../utils/format';
import type { MyActivity } from '../types';

export default function MyActivities() {
  const [activities, setActivities] = useState<MyActivity[] | null>(null);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const load = () => activityApi.my().then(setActivities).catch(() => setActivities([]));
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
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <KeyRound className="h-5 w-5 text-blue-600" /> Klaim Token Kegiatan
        </h2>
        <p className="mb-3 text-sm text-gray-500">Masukkan token 7 karakter yang diberikan admin.</p>
        <form onSubmit={claim} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="cth: A7K9M2X"
            maxLength={7}
            className="font-mono uppercase tracking-widest"
            required
          />
          <Button type="submit" disabled={claiming || code.length !== 7}>
            {claiming ? 'Memproses...' : 'Klaim'}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Kegiatan Saya</h2>
        {activities === null ? (
          <LoadingState />
        ) : activities.length === 0 ? (
          <EmptyState text="Belum ada kegiatan. Klaim token dulu." />
        ) : (
          <ul className="divide-y">
            {activities.map((a) => {
              const expired = new Date(a.token_expires_at).getTime() < Date.now() || !a.token_is_active;
              return (
                <li key={a.activity_id} className="flex items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      Diklaim {formatDateTime(a.claimed_at)} · Token s.d. {formatDateTime(a.token_expires_at)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      expired ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {expired ? 'Kedaluwarsa' : 'Aktif'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
