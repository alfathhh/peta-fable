import { useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { downloadBlob, importApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button } from '../../components/ui';
import { toast } from '../../stores/toastStore';

const MODULES = [
  ['users', 'Pengguna'],
  ['infrastructures', 'Infrastruktur'],
  ['projects', 'Proyek'],
  ['tokens', 'Token'],
  ['activities', 'Kegiatan'],
] as const;

interface ValidateResult {
  upload_id: string;
  valid_rows: number;
  invalid_rows: { row: number; errors: string[] }[];
  summary: { total: number; valid: number; invalid: number };
}

export default function AdminImportExport() {
  const [preview, setPreview] = useState<ValidateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<{ saved: number; failed: number; failed_download_url: string | null } | null>(null);

  async function exportModule(module: string, format: 'csv' | 'xlsx') {
    try {
      await downloadBlob(`/admin/export/${module}`, { format });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function validate(file: File) {
    setBusy(true);
    setCommitted(null);
    try {
      setPreview(await importApi.validate(file));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await importApi.commit(preview.upload_id);
      setCommitted(result);
      setPreview(null);
      toast.success(`${result.saved} baris tersimpan`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="mb-3 text-lg font-semibold">Export Data</h1>
        <ul className="divide-y">
          {MODULES.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium">{label}</span>
              <span className="flex gap-2">
                <Button variant="secondary" onClick={() => void exportModule(key, 'csv')}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button variant="secondary" onClick={() => void exportModule(key, 'xlsx')}>
                  <FileSpreadsheet className="h-4 w-4" /> XLSX
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Import Bulk Infrastruktur</h2>
        <p className="mb-3 text-sm text-gray-500">
          1) Unduh template → 2) isi → 3) upload untuk validasi → 4) konfirmasi. Hanya baris valid yang disimpan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void downloadBlob('/admin/import/infrastructures/template')}>
            <Download className="h-4 w-4" /> Unduh Template XLSX
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
            <Upload className="h-4 w-4" /> {busy ? 'Memproses...' : 'Upload File Isian'}
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void validate(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {preview && (
          <div className="mt-4 space-y-3 rounded-xl border p-3">
            <p className="text-sm">
              Total <b>{preview.summary.total}</b> baris — <b className="text-green-600">{preview.summary.valid} valid</b>,{' '}
              <b className="text-red-600">{preview.summary.invalid} error</b>.
            </p>
            {preview.invalid_rows.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg bg-red-50 p-2 text-xs">
                {preview.invalid_rows.map((r) => (
                  <p key={r.row}>
                    <b>Baris {r.row}:</b> {r.errors.join('; ')}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void commit()} disabled={busy || preview.summary.valid === 0}>
                Simpan {preview.summary.valid} Baris Valid
              </Button>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {committed && (
          <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            <p>
              {committed.saved} baris tersimpan, {committed.failed} gagal.
            </p>
            {committed.failed_download_url && (
              <button
                onClick={() => void downloadBlob(committed.failed_download_url!.replace(/^\/api/, ''))}
                className="mt-1 font-medium text-red-700 underline"
              >
                Unduh baris gagal (.xlsx) untuk diperbaiki
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
