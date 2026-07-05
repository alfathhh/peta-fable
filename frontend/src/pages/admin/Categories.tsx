import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { categoryApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, Input, LoadingState, Modal } from '../../components/ui';
import { CATEGORY_ICONS, getCategoryIcon } from '../../config/categoryIcons';
import { toast } from '../../stores/toastStore';
import type { Category } from '../../types';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'map-pin', color: '#2563eb' });
  const [saving, setSaving] = useState(false);

  const load = () => categoryApi.list().then(setCategories).catch(() => setCategories([]));
  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', icon: 'map-pin', color: '#2563eb' });
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, icon: c.icon, color: c.color });
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await categoryApi.update(editing.id, form);
        toast.success('Kategori diperbarui');
      } else {
        await categoryApi.create(form);
        toast.success('Kategori dibuat');
      }
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await categoryApi.remove(c.id);
      toast.success('Kategori dihapus');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  const PreviewIcon = getCategoryIcon(form.icon);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kategori Infrastruktur</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah Kategori
        </Button>
      </div>

      {categories === null ? (
        <LoadingState />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.icon);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: c.color }}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.icon} · {c.color}
                  </p>
                </div>
                <button onClick={() => openEdit(c)} className="rounded p-1.5 text-gray-400 hover:text-blue-600" title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => void remove(c)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Kategori' : 'Tambah Kategori'} wide>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-white shadow" style={{ background: form.color }}>
              <PreviewIcon className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <Input label="Nama kategori" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <label className="text-sm">
              Warna
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="block h-10 w-14" />
            </label>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Ikon (pustaka Lucide)</p>
            <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-10">
              {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm({ ...form, icon: name })}
                  className={`flex h-9 items-center justify-center rounded ${form.icon === name ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  title={name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving || !form.name}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
