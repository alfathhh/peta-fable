import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { userApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, Input, LoadingState, Modal, Select } from '../../components/ui';
import { toast } from '../../stores/toastStore';
import { formatDateTime } from '../../utils/format';
import type { User } from '../../types';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'petugas' });
  const [saving, setSaving] = useState(false);

  const load = () => userApi.list().then(setUsers).catch(() => setUsers([]));
  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', username: '', email: '', password: '', role: 'petugas' });
    setOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, username: u.username, email: u.email ?? '', password: '', role: u.role });
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await userApi.update(editing.id, {
          name: form.name,
          email: form.email || undefined,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success('User diperbarui');
      } else {
        await userApi.create({
          name: form.name,
          username: form.username,
          email: form.email || undefined,
          password: form.password,
          role: form.role,
        });
        toast.success('User dibuat');
      }
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    try {
      await userApi.update(u.id, { is_active: !u.isActive });
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(u: User) {
    if (!confirm(`Hapus user "${u.username}"?`)) return;
    try {
      await userApi.remove(u.id);
      toast.success('User dihapus');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Manajemen Pengguna</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah User
        </Button>
      </div>

      {users === null ? (
        <LoadingState />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 uppercase text-xs font-medium">{u.role}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void toggleActive(u)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(u)} className="rounded p-1.5 text-gray-400 hover:text-blue-600" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => void remove(u)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit User' : 'Tambah User'}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          {!editing && (
            <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          )}
          <Input label="Email (opsional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
            label={editing ? 'Password baru (kosongkan bila tidak diganti)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
          <Select label="Peran" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="petugas">petugas</option>
            <option value="admin">admin</option>
          </Select>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
