import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Waypoints } from 'lucide-react';
import { authApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Button, Input } from '../components/ui';

export default function Login() {
  const { token, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token: t, user } = await authApi.login(username, password);
      setAuth(t, user);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-[#eef1eb] p-4">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#cbd5ca_1px,transparent_1px),linear-gradient(90deg,#cbd5ca_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute -left-20 top-12 h-64 w-64 rounded-full bg-emerald-200/50 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-sm space-y-5 rounded-3xl border border-white/80 bg-white/95 p-6 shadow-xl backdrop-blur sm:p-8">
        <div className="flex flex-col items-center gap-2 pb-2 text-center">
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800">
            <Waypoints className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Sistem Informasi Wilayah</p>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Peta Tematik Padang Pariaman</h1>
          <p className="text-sm text-stone-500">Masuk dengan akun yang dibuat admin</p>
        </div>
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Memproses...' : 'Masuk'}
        </Button>
      </form>
    </div>
  );
}
