import { useEffect, useState, type FormEvent } from 'react';
import { Camera, Pencil } from 'lucide-react';
import { categoryApi, infraApi, regionApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { compressPhoto } from '../utils/photo';
import { getCategoryIcon } from '../config/categoryIcons';
import { Button, Input, Select, Textarea } from './ui';
import { PhotoEditor } from './PhotoEditor';
import { MiniMapPicker } from './map/MiniMapPicker';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import type { Category, InfraDetail, RegionOption } from '../types';
import type { GpsPosition } from './map/CurrentLocation';

/** Dropdown wilayah manual: kec, desa, SLS wajib; sub-SLS opsional (turunan prefix idsls). */
function ManualRegionPicker({
  value,
  onChange,
}: {
  value: { idsls: string; idsubsls: string };
  onChange: (v: { idsls: string; idsubsls: string }) => void;
}) {
  const [kec, setKec] = useState('');
  const [desa, setDesa] = useState('');
  const [options, setOptions] = useState<Record<string, RegionOption[]>>({});

  useEffect(() => {
    regionApi.options('kec', '1306').then((o) => setOptions((p) => ({ ...p, kec: o }))).catch(() => {});
  }, []);

  async function loadOptions(level: string, parent: string) {
    try {
      const o = await regionApi.options(level, parent);
      setOptions((p) => ({ ...p, [level]: o }));
    } catch {
      /* abaikan */
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <Select
        label="Kecamatan *"
        value={kec}
        onChange={(e) => {
          setKec(e.target.value);
          setDesa('');
          onChange({ idsls: '', idsubsls: '' });
          if (e.target.value) void loadOptions('desa', e.target.value);
        }}
        required
      >
        <option value="">— Pilih kecamatan —</option>
        {(options.kec ?? []).map((o) => (
          <option key={o.region_id} value={o.region_id}>
            {o.name}
          </option>
        ))}
      </Select>
      <Select
        label="Desa/Nagari *"
        value={desa}
        disabled={!kec}
        onChange={(e) => {
          setDesa(e.target.value);
          onChange({ idsls: '', idsubsls: '' });
          if (e.target.value) void loadOptions('sls', e.target.value);
        }}
        required
      >
        <option value="">— Pilih desa/nagari —</option>
        {(options.desa ?? []).map((o) => (
          <option key={o.region_id} value={o.region_id}>
            {o.name}
          </option>
        ))}
      </Select>
      <Select
        label="SLS/Korong *"
        value={value.idsls}
        disabled={!desa}
        onChange={(e) => {
          onChange({ idsls: e.target.value, idsubsls: '' });
          if (e.target.value) void loadOptions('subsls', e.target.value);
        }}
        required
      >
        <option value="">— Pilih SLS/korong —</option>
        {(options.sls ?? []).map((o) => (
          <option key={o.region_id} value={o.region_id}>
            {o.name} ({o.region_id})
          </option>
        ))}
      </Select>
      <Select
        label="Sub-SLS (opsional)"
        value={value.idsubsls}
        disabled={!value.idsls}
        onChange={(e) => onChange({ ...value, idsubsls: e.target.value })}
      >
        <option value="">— Tanpa sub-SLS —</option>
        {(options.subsls ?? []).map((o) => (
          <option key={o.region_id} value={o.region_id}>
            {o.name} ({o.region_id})
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Form tambah/edit infrastruktur petugas.
 * Koordinat read-only dari GPS (create). Wilayah: auto-detect dari titik,
 * atau manual (kec/desa/SLS wajib, sub-SLS opsional — id turunan prefix idsls).
 */
export function InfraForm({
  projectId,
  gps,
  gpsError,
  existing,
  onSaved,
}: {
  projectId: string;
  gps: GpsPosition | null;
  gpsError: string | null;
  existing?: InfraDetail | null;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  // koordinat pada mode edit hanya bisa digeser admin (aturan domain #4)
  const canMovePin = !isEdit || isAdmin;
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(existing?.name ?? '');
  const [categoryId, setCategoryId] = useState(existing?.category.id ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(existing?.photo_url ?? null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [regionMode, setRegionMode] = useState<'auto' | 'manual'>('auto');
  const [manualRegion, setManualRegion] = useState({ idsls: '', idsubsls: '' });
  // koordinat: awalnya ikut GPS (create) / titik tersimpan (edit); bisa digeser di minimap
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    existing ? { lat: existing.lat, lng: existing.lng } : null,
  );
  const [followGps, setFollowGps] = useState(!existing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit && followGps && gps) setCoords({ lat: gps.lat, lng: gps.lng });
  }, [isEdit, followGps, gps]);

  useEffect(() => {
    categoryApi.list().then((c) => setCategories(c.filter((x) => x.isActive))).catch(() => {});
  }, []);

  function openEditorWithFile(file: File) {
    setEditorSrc(URL.createObjectURL(file));
    setEditorOpen(true);
  }

  /** Edit foto yang sudah tersimpan (fetch ber-auth → editor). */
  async function editExistingPhoto() {
    if (photo) {
      openEditorWithFile(photo);
      return;
    }
    if (!existing?.photo_url) return;
    try {
      const url = await infraApi.photoBlobUrl(existing.photo_url);
      setEditorSrc(url);
      setEditorOpen(true);
    } catch {
      toast.error('Gagal memuat foto');
    }
  }

  async function onCropped(file: File) {
    try {
      const compressed = await compressPhoto(file);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error('Gagal memproses foto');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!coords) return;
    if (regionMode === 'manual' && !manualRegion.idsls) {
      toast.error('Mode manual: kecamatan, desa/nagari, dan SLS wajib dipilih');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('category_id', categoryId);
      if (description) fd.append('description', description);
      if (photo) fd.append('photo', photo, 'foto.jpg');
      if (regionMode === 'manual') {
        fd.append('idsls', manualRegion.idsls);
        if (manualRegion.idsubsls) fd.append('idsubsls', manualRegion.idsubsls);
      }
      if (isEdit) {
        // kirim koordinat hanya bila digeser dari titik tersimpan
        if (coords.lat !== existing!.lat || coords.lng !== existing!.lng) {
          fd.append('lat', String(coords.lat));
          fd.append('lng', String(coords.lng));
        }
        await infraApi.update(existing!.id, fd);
        toast.success('Infrastruktur diperbarui');
      } else {
        fd.append('lat', String(coords.lat));
        fd.append('lng', String(coords.lng));
        if (gps) fd.append('gps_accuracy_m', String(Math.round(gps.accuracy)));
        fd.append('project_id', projectId);
        const res = await infraApi.create(fd);
        if (res.meta?.warning) toast.warning(res.meta.warning);
        else toast.success('Infrastruktur tersimpan — menunggu ACC admin untuk tampil di peta umum');
      }
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedCat = categories.find((c) => c.id === categoryId);
  const SelectedIcon = selectedCat ? getCategoryIcon(selectedCat.icon) : null;

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* foto: maks 1, kamera/galeri, editor crop/zoom, dikompres di client */}
      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">Foto (opsional, maks 1)</span>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 hover:bg-gray-50">
            <Camera className="h-6 w-6 text-gray-400" />
            <span className="text-sm text-gray-500">{preview ? 'Ganti foto' : 'Ambil / pilih foto'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) openEditorWithFile(f);
                e.target.value = '';
              }}
            />
          </label>
          {preview && (
            <Button type="button" variant="secondary" onClick={() => void editExistingPhoto()} title="Edit foto (crop/zoom)">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
        </div>
        {preview && <img src={preview} alt="Pratinjau" className="mt-2 max-h-40 rounded-lg object-cover" />}
      </div>

      <Input label="Nama infrastruktur" value={name} onChange={(e) => setName(e.target.value)} required />

      <div>
        <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          <option value="">— Pilih kategori —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {selectedCat && SelectedIcon && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
            Pin:
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: selectedCat.color }}>
              <SelectedIcon className="h-3 w-3" />
            </span>
            {selectedCat.name}
          </p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Koordinat{' '}
          {!isEdit
            ? '(dari GPS — geser pin untuk menyesuaikan)'
            : canMovePin
              ? '(geser pin bila titik kurang tepat)'
              : ''}
        </span>
        {isEdit && !canMovePin && (
          <p className="mb-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            Koordinat hanya bisa diubah oleh admin. Jika titik salah, hubungi admin atau hapus dan buat ulang di lokasi.
          </p>
        )}
        {coords ? (
          <div className="space-y-2">
            {canMovePin && (
              <MiniMapPicker
                lat={coords.lat}
                lng={coords.lng}
                onChange={(p) => {
                  setCoords(p);
                  setFollowGps(false);
                }}
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                {!isEdit && followGps && gps && (
                  <span className="ml-2 text-gray-500">±{Math.round(gps.accuracy)} m (GPS)</span>
                )}
              </p>
              {!isEdit && !followGps && gps && (
                <Button type="button" variant="secondary" onClick={() => setFollowGps(true)}>
                  Ikuti GPS lagi
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
            {gpsError ?? 'Menunggu sinyal GPS... Pastikan izin lokasi aktif.'}
          </p>
        )}
      </div>

      {/* wilayah: auto-detect dari titik, atau pilih manual sampai sub-SLS */}
      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">Wilayah</span>
        <div className="mb-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={regionMode === 'auto'} onChange={() => setRegionMode('auto')} />
            Deteksi otomatis dari lokasi
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={regionMode === 'manual'} onChange={() => setRegionMode('manual')} />
            Pilih manual
          </label>
        </div>
        {regionMode === 'manual' ? (
          <ManualRegionPicker value={manualRegion} onChange={setManualRegion} />
        ) : (
          <p className="text-xs text-gray-500">
            Wilayah (kec/desa/SLS/sub-SLS) ditentukan otomatis dari titik koordinat di server.
          </p>
        )}
      </div>

      <Textarea label="Deskripsi" value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />

      <Button
        type="submit"
        className="w-full"
        disabled={saving || !name || !categoryId || !coords || (regionMode === 'manual' && !manualRegion.idsls)}
      >
        {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Infrastruktur'}
      </Button>

      <PhotoEditor src={editorSrc} open={editorOpen} onClose={() => setEditorOpen(false)} onDone={(f) => void onCropped(f)} />
    </form>
  );
}
