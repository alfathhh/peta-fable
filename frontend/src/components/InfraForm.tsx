import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  const requestId = useRef(0);

  useEffect(() => {
    regionApi.options('kec', '1306').then((o) => setOptions((p) => ({ ...p, kec: o }))).catch(() => {});
  }, []);

  async function loadOptions(level: string, parent: string) {
    const id = requestId.current;
    try {
      const o = await regionApi.options(level, parent);
      if (id !== requestId.current) return;
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
          requestId.current++;
          setKec(e.target.value);
          setDesa('');
          setOptions((current) => ({ ...current, desa: [], sls: [], subsls: [] }));
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
          requestId.current++;
          setDesa(e.target.value);
          setOptions((current) => ({ ...current, sls: [], subsls: [] }));
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
          requestId.current++;
          onChange({ idsls: e.target.value, idsubsls: '' });
          setOptions((current) => ({ ...current, subsls: [] }));
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
  // Koordinat petugas selalu terkunci ke GPS; hanya admin yang dapat menggeser pin.
  const canMovePin = isAdmin;
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(existing?.name ?? '');
  const [categoryId, setCategoryId] = useState(existing?.category.id ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
  const [accuracyLimitEnabled, setAccuracyLimitEnabled] = useState(true);
  const [accuracyLimit, setAccuracyLimit] = useState('20');
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationSeconds, setCalibrationSeconds] = useState(10);
  const [calibrationCandidate, setCalibrationCandidate] = useState<GpsPosition | null>(null);
  const [calibratedAccuracy, setCalibratedAccuracy] = useState<number | null>(null);
  const calibrationSamplesRef = useRef<GpsPosition[]>([]);

  useEffect(() => {
    if (!existing?.photo_url) return;
    let active = true;
    let url: string | null = null;
    void infraApi.photoBlobUrl(existing.photo_url).then((objectUrl) => {
      if (active) {
        url = objectUrl;
        setPreview(objectUrl);
      } else URL.revokeObjectURL(objectUrl);
    }).catch(() => setPreview(null));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [existing?.photo_url]);

  useEffect(() => {
    if (!isEdit && followGps && gps) setCoords({ lat: gps.lat, lng: gps.lng });
  }, [isEdit, followGps, gps]);

  useEffect(() => {
    if (calibrating && gps) calibrationSamplesRef.current.push(gps);
  }, [calibrating, gps]);

  useEffect(() => {
    if (!calibrating) return;
    const timer = window.setInterval(() => {
      setCalibrationSeconds((seconds) => {
        if (seconds > 1) return seconds - 1;
        window.clearInterval(timer);
        setCalibrating(false);
        const samples = calibrationSamplesRef.current;
        if (samples.length === 0) {
          toast.error('Kalibrasi gagal: belum ada sampel GPS');
          return 0;
        }
        let totalWeight = 0;
        let lat = 0;
        let lng = 0;
        let weightedAccuracy = 0;
        for (const sample of samples) {
          const weight = 1 / Math.max(sample.accuracy, 1) ** 2;
          totalWeight += weight;
          lat += sample.lat * weight;
          lng += sample.lng * weight;
          weightedAccuracy += sample.accuracy * weight;
        }
        const candidate = { lat: lat / totalWeight, lng: lng / totalWeight, accuracy: weightedAccuracy / totalWeight };
        const limit = Number(accuracyLimit);
        const meetsLimit = !accuracyLimitEnabled || (Number.isFinite(limit) && candidate.accuracy <= limit);
        if (meetsLimit) {
          setCoords({ lat: candidate.lat, lng: candidate.lng });
          setCalibratedAccuracy(candidate.accuracy);
          setFollowGps(false);
          setCalibrationCandidate(null);
          toast.success(`Kalibrasi selesai (akurasi ±${Math.round(candidate.accuracy)} m)`);
        } else {
          setCalibrationCandidate(candidate);
          toast.warning(`Target belum tercapai: hasil ±${Math.round(candidate.accuracy)} m`);
        }
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [calibrating, accuracyLimit, accuracyLimitEnabled]);

  function startCalibration() {
    calibrationSamplesRef.current = [];
    setCalibrationCandidate(null);
    setCalibrationSeconds(10);
    setCalibrating(true);
  }

  function useCalibrationCandidate() {
    if (!calibrationCandidate) return;
    setCoords({ lat: calibrationCandidate.lat, lng: calibrationCandidate.lng });
    setCalibratedAccuracy(calibrationCandidate.accuracy);
    setFollowGps(false);
    setCalibrationCandidate(null);
  }

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
      setPreview((old) => {
        if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
        return URL.createObjectURL(compressed);
      });
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
      // Pada edit, string kosong harus tetap dikirim agar deskripsi lama dapat dihapus.
      if (isEdit || description) fd.append('description', description);
      if (photo) fd.append('photo', photo, 'foto.jpg');
      if (!isEdit && isAdmin && regionMode === 'manual') {
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
        const accuracy = calibratedAccuracy ?? gps?.accuracy;
        if (accuracy !== undefined) fd.append('gps_accuracy_m', String(Math.round(accuracy)));
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
            ? isAdmin
              ? '(dari GPS — dapat dikoreksi admin)'
              : '(GPS saat ini — otomatis)'
            : canMovePin
              ? '(geser pin bila titik kurang tepat)'
              : ''}
        </span>
        {!canMovePin && (
          <p className="mb-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            {isEdit
              ? 'Koordinat yang sudah diambil hanya bisa diubah oleh admin.'
              : 'Pin mengikuti GPS saat ini dan tidak dapat digeser oleh petugas.'}
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
        {!isEdit && !isAdmin && (
          <div className="mt-2 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-900">Kalibrasi GPS 10 detik</p>
                <p className="text-xs text-blue-700">Menggabungkan beberapa sampel GPS untuk menstabilkan titik.</p>
              </div>
              <Button type="button" variant="secondary" disabled={calibrating || !gps} onClick={startCalibration}>
                {calibrating ? `${calibrationSeconds} dtk` : 'Kalibrasi'}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-blue-900">
              <input
                type="checkbox"
                checked={accuracyLimitEnabled}
                disabled={calibrating}
                onChange={(event) => setAccuracyLimitEnabled(event.target.checked)}
              />
              Gunakan target akurasi
              <input
                type="number"
                min="1"
                max="1000"
                value={accuracyLimit}
                disabled={!accuracyLimitEnabled || calibrating}
                onChange={(event) => setAccuracyLimit(event.target.value)}
                className="w-20 rounded border border-blue-200 bg-white px-2 py-1"
                aria-label="Target akurasi GPS dalam meter"
              />
              meter
            </label>
            {!accuracyLimitEnabled && <p className="text-xs text-blue-700">Batas akurasi dinonaktifkan; hasil 10 detik langsung digunakan.</p>}
            {calibrationCandidate && (
              <div className="flex items-center justify-between gap-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
                <span>Hasil ±{Math.round(calibrationCandidate.accuracy)} m belum memenuhi target.</span>
                <Button type="button" variant="secondary" onClick={useCalibrationCandidate}>Gunakan hasil ini</Button>
              </div>
            )}
            {calibratedAccuracy !== null && <p className="text-xs font-medium text-green-700">Hasil kalibrasi aktif: ±{Math.round(calibratedAccuracy)} m</p>}
          </div>
        )}
      </div>

      {/* Wilayah hanya dipilih saat membuat titik; edit petugas tidak boleh menggesernya. */}
      {!isEdit && isAdmin && <div>
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
      </div>}
      {!isEdit && !isAdmin && (
        <p className="text-xs text-gray-500">
          Wilayah ditentukan otomatis oleh server berdasarkan koordinat GPS saat disimpan.
        </p>
      )}

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
