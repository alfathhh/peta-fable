import { useEffect, useState, type FormEvent } from 'react';
import { Download, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { downloadBlob, importApi, userApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, EmptyState, IconButton, Input, LoadingState, Modal, PageHeader, Select, StatusBadge, TableShell } from '../../components/ui';
import { toast } from '../../stores/toastStore';
import { formatDateTime } from '../../utils/format';
import type { User } from '../../types';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'petugas' });
  const [saving, setSaving] = useState(false);
  const [importPreview, setImportPreview] = useState<{ upload_id: string; summary: { total: number; valid: number; invalid: number }; invalid_rows: { row: number; errors: string[] }[] } | null>(null);
  const [importBusy, setImportBusy] = useState(false);

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

  async function validateImport(file: File) {
    setImportBusy(true);
    try { setImportPreview(await importApi.validate(file, 'users')); }
    catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setImportBusy(false); }
  }

  async function commitImport() {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      const result = await importApi.commit(importPreview.upload_id, 'users');
      toast.success(`${result.saved} pengguna tersimpan`);
      setImportPreview(null);
      void load();
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setImportBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="Administrasi" title="Pengguna" description="Kelola akun, peran, dan akses aplikasi." actions={<div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void downloadBlob('/admin/import/users/template')}>
            <Download className="h-4 w-4" /> Template XLSX
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium hover:bg-gray-200">
            <Upload className="h-4 w-4" /> {importBusy ? 'Memproses...' : 'Import Bulk'}
            <input type="file" accept=".xlsx" className="hidden" disabled={importBusy} onChange={(e) => {
              const file = e.target.files?.[0]; if (file) void validateImport(file); e.target.value = '';
            }} />
          </label>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Tambah User</Button>
        </div>} />

      {importPreview && (
        <div className="rounded-xl border bg-white p-3 text-sm shadow-sm">
          <p>Total <b>{importPreview.summary.total}</b>: <b className="text-green-600">{importPreview.summary.valid} valid</b>, <b className="text-red-600">{importPreview.summary.invalid} error</b>.</p>
          {importPreview.invalid_rows.length > 0 && <div className="my-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 text-xs">{importPreview.invalid_rows.map((row) => <p key={row.row}><b>Baris {row.row}:</b> {row.errors.join('; ')}</p>)}</div>}
          <div className="mt-2 flex gap-2"><Button disabled={importBusy || importPreview.summary.valid === 0} onClick={() => void commitImport()}>Simpan {importPreview.summary.valid} Pengguna</Button><Button variant="secondary" onClick={() => setImportPreview(null)}>Batal</Button></div>
        </div>
      )}

      {users === null ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState text="Belum ada pengguna." />
      ) : (
        <>
        <div className="space-y-3 sm:hidden">
          {users.map((u) => <div key={u.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-stone-900">{u.name}</p><p className="mt-0.5 font-mono text-xs text-stone-500">@{u.username}</p></div><StatusBadge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</StatusBadge></div><div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3"><span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{u.role}</span><div className="flex"><IconButton label={`Edit ${u.name}`} onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></IconButton><IconButton label={`Hapus ${u.name}`} variant="danger" onClick={() => void remove(u)}><Trash2 className="h-4 w-4" /></IconButton></div></div></div>)}
        </div>
        <div className="hidden sm:block"><TableShell>
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
                      className="rounded-full"
                    >
                      <StatusBadge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</StatusBadge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <IconButton label={`Edit ${u.name}`} onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={`Hapus ${u.name}`} variant="danger" onClick={() => void remove(u)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell></div>
        </>
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
