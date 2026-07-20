import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Check, CheckCircle2, Clock3, FileSpreadsheet, MapPinOff, Pencil, Plus, Trash2, X, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { categoryApi, infraApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, IconButton, Input, LoadingState, Modal, Select, StatusBadge, Textarea } from '../../components/ui';
import { PhotoEditor } from '../../components/PhotoEditor';
import { MiniMapPicker } from '../../components/map/MiniMapPicker';
import { compressPhoto } from '../../utils/photo';
import { toast } from '../../stores/toastStore';
import { getCategoryIcon } from '../../config/categoryIcons';
import type { Category, InfraDetail } from '../../types';

function ApprovalBadge({ status }: { status: InfraDetail['approvalStatus'] }) {
  if (status === 'approved') return <StatusBadge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> Disetujui</StatusBadge>;
  if (status === 'rejected') return <StatusBadge tone="danger"><XCircle className="h-3.5 w-3.5" /> Ditolak</StatusBadge>;
  return <StatusBadge tone="warning"><Clock3 className="h-3.5 w-3.5" /> Menunggu</StatusBadge>;
}

function OutsideBadge() {
  return <StatusBadge tone="warning"><MapPinOff className="h-3.5 w-3.5" /> Di luar wilayah</StatusBadge>;
}

function CategoryMark({ category }: { category: Pick<Category, 'name' | 'icon' | 'color'> }) {
  const Icon = getCategoryIcon(category.icon);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-stone-700">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-2 ring-white" style={{ backgroundColor: category.color }}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.3} />
      </span>
      {category.name}
    </span>
  );
}

export default function AdminInfrastructures() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InfraDetail[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, total: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState({
    q: '',
    category_id: '',
    is_outside_region: searchParams.get('is_outside_region') ?? '',
    approval_status: searchParams.get('approval_status') ?? '',
  });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<InfraDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', description: '', lat: '', lng: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoUrlRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    categoryApi.list().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(() => {
    const requestId = ++loadRequestRef.current;
    infraApi
      .adminList({
        page,
        per_page: 20,
        q: filter.q || undefined,
        category_id: filter.category_id || undefined,
        is_outside_region: filter.is_outside_region || undefined,
        approval_status: filter.approval_status || undefined,
      })
      .then((res) => {
        if (requestId !== loadRequestRef.current) return;
        setRows(res.data);
        setMeta(res.meta);
      })
      .catch(() => {
        if (requestId === loadRequestRef.current) setRows([]);
      });
  }, [page, filter]);

  useEffect(() => {
    const timer = window.setTimeout(load, filter.q ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [load, filter.q]);

  function openEdit(r: InfraDetail) {
    setEditing(r);
    setPhoto(null);
    setPhotoPreview(null);
    setForm({
      name: r.name,
      category_id: r.category.id,
      description: r.description ?? '',
      lat: String(r.lat),
      lng: String(r.lng),
    });
  }

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setPhoto(null);
    setPhotoPreview(null);
    setForm({ name: '', category_id: categories[0]?.id ?? '', description: '', lat: '', lng: '' });
  }

  useEffect(() => {
    if (!editing?.photo_url) return;
    let active = true;
    void infraApi.photoBlobUrl(editing.photo_url).then((url) => {
      if (active) {
        photoUrlRef.current = url;
        setPhotoPreview(url);
      } else URL.revokeObjectURL(url);
    }).catch(() => setPhotoPreview(null));
    return () => {
      active = false;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    };
  }, [editing?.photo_url]);

  async function editPhoto() {
    if (photo) {
      setEditorSrc(URL.createObjectURL(photo));
      setEditorOpen(true);
      return;
    }
    if (!editing?.photo_url) return;
    try {
      setEditorSrc(await infraApi.photoBlobUrl(editing.photo_url));
      setEditorOpen(true);
    } catch {
      toast.error('Gagal memuat foto');
    }
  }

  async function onCropped(file: File) {
    try {
      const compressed = await compressPhoto(file);
      setPhoto(compressed);
      setPhotoPreview((old) => {
        if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
        return URL.createObjectURL(compressed);
      });
    } catch {
      toast.error('Gagal memproses foto');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing && !creating) return;
    setSaving(true);
    try {
      const lat = Number(form.lat);
      const lng = Number(form.lng);
      if (!form.lat.trim() || !form.lng.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast.error('Latitude dan longitude wajib diisi dengan angka yang valid');
        return;
      }
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('category_id', form.category_id);
      fd.append('description', form.description);
      fd.append('lat', String(lat)); // admin boleh koreksi koordinat (data import)
      fd.append('lng', String(lng));
      if (photo) fd.append('photo', photo, 'foto.jpg');
      if (editing) {
        await infraApi.update(editing.id, fd);
        toast.success('Diperbarui');
      } else {
        await infraApi.adminCreate(fd);
        toast.success('Infrastruktur dibuat dan langsung di-ACC');
      }
      setEditing(null);
      setCreating(false);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function setApproval(r: InfraDetail, status: 'approved' | 'rejected') {
    let note: string | undefined;
    if (status === 'rejected') {
      const input = prompt(`Alasan penolakan "${r.name}" (terlihat oleh petugas, opsional):`);
      if (input === null) return; // batal
      note = input.trim() || undefined;
    }
    try {
      await infraApi.setApproval(r.id, status, note);
      toast.success(status === 'approved' ? `"${r.name}" di-ACC — tampil di peta umum` : `"${r.name}" ditolak`);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(r: InfraDetail) {
    if (!confirm(`Hapus "${r.name}"?`)) return;
    try {
      await infraApi.remove(r.id);
      toast.success('Dihapus');
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Semua Infrastruktur ({meta.total})</h1>
        <div className="flex gap-2">
          <Link to="/admin/import-export" className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium hover:bg-gray-200">
            <FileSpreadsheet className="h-4 w-4" /> Import XLSX
          </Link>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Tambah Infrastruktur</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={filter.q}
          onChange={(e) => {
            setPage(1);
            setFilter({ ...filter, q: e.target.value });
          }}
          placeholder="Cari nama..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={filter.category_id}
          onChange={(e) => {
            setPage(1);
            setFilter({ ...filter, category_id: e.target.value });
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filter.is_outside_region}
          onChange={(e) => {
            setPage(1);
            setFilter({ ...filter, is_outside_region: e.target.value });
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Semua titik</option>
          <option value="true">Di luar wilayah proyek</option>
          <option value="false">Di dalam wilayah proyek</option>
        </select>
        <select
          value={filter.approval_status}
          onChange={(e) => {
            setPage(1);
            setFilter({ ...filter, approval_status: e.target.value });
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Semua status ACC</option>
          <option value="pending">Menunggu ACC</option>
          <option value="approved">Di-ACC</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>

      {rows === null ? (
        <LoadingState />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <article key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-stone-900">{r.name}</h2><p className="mt-1 font-mono text-xs text-stone-500">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</p></div>
                  <CategoryMark category={r.category} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ApprovalBadge status={r.approvalStatus} />
                  {r.isOutsideRegion && <OutsideBadge />}
                  <span className="text-xs text-stone-500">@{r.user?.username}</span>
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t border-stone-100 pt-3">
                  {r.approvalStatus !== 'approved' && <IconButton label={`ACC ${r.name}`} onClick={() => void setApproval(r, 'approved')}><Check className="h-4 w-4 text-emerald-700" /></IconButton>}
                  {r.approvalStatus !== 'rejected' && <IconButton label={`Tolak ${r.name}`} variant="danger" onClick={() => void setApproval(r, 'rejected')}><X className="h-4 w-4" /></IconButton>}
                  <IconButton label={`Edit ${r.name}`} onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label={`Hapus ${r.name}`} variant="danger" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm lg:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Koordinat</th>
                  <th className="px-4 py-3">Wilayah</th>
                  <th className="px-4 py-3">Petugas</th>
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3">ACC</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3"><CategoryMark category={r.category} /></td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.idsubsls ?? r.idsls ?? r.iddesa ?? r.idkec ?? r.idkab}</td>
                    <td className="px-4 py-3 text-xs">{r.user?.username}</td>
                    <td className="px-4 py-3">
                      {r.isOutsideRegion && <OutsideBadge />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ApprovalBadge status={r.approvalStatus} />
                        <div className="flex items-center border-l border-stone-200 pl-1">
                        {r.approvalStatus !== 'approved' && (
                          <button
                            onClick={() => void setApproval(r, 'approved')}
                            className="rounded p-1 text-green-600 hover:bg-green-50"
                            title="ACC — tampilkan di peta umum"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {r.approvalStatus !== 'rejected' && (
                          <button
                            onClick={() => void setApproval(r, 'rejected')}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Tolak — hanya terlihat oleh petugas pembuat"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(r)} className="rounded p-1.5 text-gray-400 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => void remove(r)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Sebelumnya
            </Button>
            <span className="text-gray-500">
              Hal {meta.page} / {Math.max(1, meta.total_pages)}
            </span>
            <Button variant="secondary" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>
              Berikutnya →
            </Button>
          </div>
        </>
      )}

      <Modal open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false); }} title={editing ? 'Edit Infrastruktur (admin)' : 'Tambah Infrastruktur (admin)'}>
        <form onSubmit={submit} className="space-y-3">
          {/* foto: ganti / crop / zoom seperti form petugas */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Foto</span>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 hover:bg-gray-50">
                <Camera className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">{photoPreview ? 'Ganti foto' : 'Pilih foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setEditorSrc(URL.createObjectURL(f));
                      setEditorOpen(true);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              {photoPreview && (
                <Button type="button" variant="secondary" onClick={() => void editPhoto()} title="Edit foto (crop/zoom)">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
            </div>
            {photoPreview && <img src={photoPreview} alt="Pratinjau" className="mt-2 max-h-40 rounded-lg object-cover" />}
          </div>

          <Input label="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Kategori" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          {/* koordinat: geser pin di minimap, atau ketik manual */}
          {editing && form.lat.trim() !== '' && form.lng.trim() !== '' && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) && (
            <MiniMapPicker
              lat={Number(form.lat)}
              lng={Number(form.lng)}
              onChange={(p) => setForm((f) => ({ ...f, lat: String(p.lat), lng: String(p.lng) }))}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input label="Latitude" type="number" min={-90} max={90} step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} required />
            <Input label="Longitude" type="number" min={-180} max={180} step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} required />
          </div>
          <Textarea label="Deskripsi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button type="submit" className="w-full" disabled={saving}>
            Simpan
          </Button>
        </form>
      </Modal>

      <PhotoEditor src={editorSrc} open={editorOpen} onClose={() => setEditorOpen(false)} onDone={(f) => void onCropped(f)} />
    </div>
  );
}
