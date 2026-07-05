import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { regionApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, Select } from '../../components/ui';
import { LEVEL_LABELS, LEVELS, type RegionLevel } from '../../utils/regionId';
import { toast } from '../../stores/toastStore';
import { formatDateTime } from '../../utils/format';

interface UploadRow {
  id: string;
  level: string;
  filename: string;
  feature_count?: number;
  featureCount?: number;
  status: string;
  note: string | null;
  createdAt: string;
  uploader?: { username: string };
}

export default function AdminRegionUpload() {
  const [level, setLevel] = useState<RegionLevel>('kec');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<UploadRow[]>([]);

  const load = () => regionApi.adminUploads().then((rows) => setHistory(rows as UploadRow[])).catch(() => {});
  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    if (!file) return;
    setUploading(true);
    try {
      await regionApi.adminUpload(level, file);
      toast.success(`Data wilayah level ${level} berhasil di-replace`);
      setFile(null);
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      void load();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">Update GeoJSON Wilayah</h1>
        <p className="mb-4 text-sm text-gray-500">
          Upload menggantikan SELURUH data wilayah pada level terpilih (transaction — gagal validasi = batal).
          File tidak pernah disajikan publik; hanya lewat API ber-login.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-48">
            <Select label="Level wilayah" value={level} onChange={(e) => setLevel(e.target.value as RegionLevel)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]} ({l})
                </option>
              ))}
            </Select>
          </div>
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-gray-700">File .geojson</span>
            <input
              type="file"
              accept=".geojson,.json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-700"
            />
          </label>
          <Button onClick={() => void submit()} disabled={!file || uploading}>
            <Upload className="h-4 w-4" /> {uploading ? 'Memproses...' : 'Upload & Replace'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Riwayat Upload</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2">Waktu</th>
              <th className="py-2">Level</th>
              <th className="py-2">File</th>
              <th className="py-2">Fitur</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.map((h) => (
              <tr key={h.id}>
                <td className="py-2 text-xs text-gray-500">{formatDateTime(h.createdAt)}</td>
                <td className="py-2 uppercase text-xs">{h.level}</td>
                <td className="py-2 text-xs">{h.filename}</td>
                <td className="py-2 text-xs">{h.featureCount ?? h.feature_count ?? '-'}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      h.status === 'done'
                        ? 'bg-green-100 text-green-700'
                        : h.status === 'failed'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                    title={h.note ?? undefined}
                  >
                    {h.status}
                  </span>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-gray-400">
                  Belum ada riwayat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
