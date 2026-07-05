// Timestamp disimpan UTC — tampilkan WIB (Asia/Jakarta).
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  return dateTimeFmt.format(new Date(value)) + ' WIB';
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  return dateFmt.format(new Date(value));
}
