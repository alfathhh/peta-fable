import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MapPinned } from 'lucide-react';
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
    <div className="flex min-h-full items-center justify-center bg-gray-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <MapPinned className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-bold">Peta Tematik Padang Pariaman</h1>
          <p className="text-sm text-gray-500">Masuk dengan akun yang dibuat admin</p>
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
