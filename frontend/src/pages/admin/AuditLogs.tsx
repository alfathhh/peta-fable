import { useEffect, useState } from 'react';
import { auditApi } from '../../api/resources';
import { Button, LoadingState } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import type { AuditLogRow } from '../../types';

const ENTITY_OPTIONS = [
  ['', 'Semua entitas'],
  ['infrastructure', 'Infrastruktur'],
  ['user', 'Pengguna'],
  ['category', 'Kategori'],
  ['token', 'Token'],
  ['regions', 'Data wilayah'],
] as const;

const ACTION_LABELS: Record<string, string> = {
  create: 'membuat',
  update: 'mengubah',
  delete: 'menghapus',
  approve: 'meng-ACC',
  reject: 'menolak',
  'reset-approval': 'mereset status ACC',
  upload: 'meng-upload',
  'import-commit': 'meng-import',
};

export default function AdminAuditLogs() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, total: 0 });
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    auditApi
      .list({ page, entity: entity || undefined })
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta);
      })
      .catch(() => setRows([]));
  }, [page, entity]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Audit Log ({meta.total})</h1>
        <select
          value={entity}
          onChange={(e) => {
            setPage(1);
            setEntity(e.target.value);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {ENTITY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {rows === null ? (
        <LoadingState />
      ) : (
        <>
          <ul className="divide-y rounded-xl bg-white shadow-sm">
            {rows.map((log) => (
              <li key={log.id} className="px-4 py-2.5">
                <p className="text-sm">
                  <span className="font-semibold">{log.username ?? 'sistem'}</span>{' '}
                  <span className="text-gray-400">({log.role ?? '-'})</span> {ACTION_LABELS[log.action] ?? log.action}{' '}
                  <span className="font-medium">{log.entity}</span>
                  {log.detail && 'name' in log.detail && (
                    <span className="text-gray-600"> “{String(log.detail.name)}”</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(log.createdAt)}
                  {log.detail && 'note' in log.detail && ` · alasan: ${String(log.detail.note)}`}
                  {log.detail && 'saved' in log.detail && ` · ${String(log.detail.saved)} baris tersimpan`}
                  {log.detail && 'level' in log.detail && ` · level ${String(log.detail.level)}`}
                </p>
              </li>
            ))}
            {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Belum ada log.</li>}
          </ul>
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
    </div>
  );
}
