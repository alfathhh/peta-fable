import { api } from './client';
import type {
  Activity,
  ActivityToken,
  AuditLogRow,
  Category,
  DashboardData,
  InfraDetail,
  InfraMarkerData,
  MyActivity,
  Project,
  ProjectDetail,
  ProjectLayer,
  RegionDetail,
  RegionOption,
  RegionSearchResult,
  RegionStat,
  User,
} from '../types';

// ---------- auth ----------
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ data: { token: string; user: User } }>('/auth/login', { username, password }).then((r) => r.data.data),
  me: () => api.get<{ data: User }>('/auth/me').then((r) => r.data.data),
  changePassword: (current_password: string, new_password: string) =>
    api.put('/auth/me/password', { current_password, new_password }),
};

// ---------- regions ----------
export const regionApi = {
  geojson: (level: string, parent?: string, detail: 'low' | 'high' = 'low') =>
    api
      .get<GeoJSON.FeatureCollection>('/regions', { params: { level, parent, detail } })
      .then((r) => r.data),
  options: (level: string, parent?: string) =>
    api.get<{ data: RegionOption[] }>('/regions/options', { params: { level, parent } }).then((r) => r.data.data),
  search: (q: string) =>
    api.get<{ data: RegionSearchResult[] }>('/regions/search', { params: { q } }).then((r) => r.data.data),
  detail: (regionId: string) =>
    api.get<{ data: RegionDetail }>(`/regions/${regionId}`).then((r) => r.data.data),
  /** Jumlah infrastruktur approved per wilayah — untuk choropleth. */
  stats: (level: string, parent?: string, categoryIds?: string[]) =>
    api
      .get<{ data: RegionStat[] }>('/regions/stats', {
        params: { level, parent, category_id: categoryIds?.length ? categoryIds.join(',') : undefined },
      })
      .then((r) => r.data.data),
  adminUpload: (level: string, file: File) => {
    const fd = new FormData();
    fd.append('level', level);
    fd.append('file', file);
    return api.post('/admin/regions/upload', fd).then((r) => r.data.data);
  },
  adminUploads: () => api.get<{ data: unknown[] }>('/admin/regions/uploads').then((r) => r.data.data),
  adminDeleteLevel: (level: string) =>
    api.delete<{ data: { level: string; deleted: number } }>(`/admin/regions/${level}`).then((r) => r.data.data),
};

// ---------- categories ----------
export const categoryApi = {
  list: () => api.get<{ data: Category[] }>('/categories').then((r) => r.data.data),
  create: (body: { name: string; icon: string; color: string }) =>
    api.post<{ data: Category }>('/admin/categories', body).then((r) => r.data.data),
  update: (id: string, body: Partial<{ name: string; icon: string; color: string; is_active: boolean }>) =>
    api.put<{ data: Category }>(`/admin/categories/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/admin/categories/${id}`),
};

// ---------- infrastructures ----------
export const infraApi = {
  list: (params: { category_id?: string; q?: string; region_id?: string }) =>
    api.get<{ data: InfraMarkerData[] }>('/infrastructures', { params }).then((r) => r.data.data),
  detail: (id: string) => api.get<{ data: InfraDetail }>(`/infrastructures/${id}`).then((r) => r.data.data),
  create: (fd: FormData) =>
    api
      .post<{ data: InfraDetail; meta?: { warning?: string } }>('/infrastructures', fd)
      .then((r) => r.data),
  update: (id: string, fd: FormData) =>
    api.put<{ data: InfraDetail }>(`/infrastructures/${id}`, fd).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/infrastructures/${id}`),
  setApproval: (id: string, status: 'pending' | 'approved' | 'rejected', note?: string) =>
    api
      .put<{ data: InfraDetail }>(`/admin/infrastructures/${id}/approval`, { status, note: note || undefined })
      .then((r) => r.data.data),
  /** Ambil foto ber-auth sebagai object URL; pemanggil wajib revoke setelah selesai. */
  photoBlobUrl: (photoUrl: string) =>
    api
      .get(photoUrl.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((r) => URL.createObjectURL(r.data as Blob)),
  adminList: (params: Record<string, string | number | boolean | undefined>) =>
    api
      .get<{ data: InfraDetail[]; meta: { page: number; per_page: number; total: number; total_pages: number } }>(
        '/admin/infrastructures',
        { params },
      )
      .then((r) => r.data),
};

// ---------- activities & tokens ----------
export const activityApi = {
  my: () => api.get<{ data: MyActivity[] }>('/my/activities').then((r) => r.data.data),
  claim: (token: string) =>
    api.post<{ data: { activity: { id: string; name: string } } }>('/tokens/claim', { token }).then((r) => r.data.data),
  adminList: () => api.get<{ data: Activity[] }>('/admin/activities').then((r) => r.data.data),
  adminCreate: (body: { name: string; description?: string }) =>
    api.post<{ data: Activity }>('/admin/activities', body).then((r) => r.data.data),
  adminUpdate: (id: string, body: { name?: string; description?: string }) =>
    api.put<{ data: Activity }>(`/admin/activities/${id}`, body).then((r) => r.data.data),
  adminRemove: (id: string) => api.delete(`/admin/activities/${id}`),
};

export const tokenApi = {
  list: (params?: { activity_id?: string; is_active?: boolean }) =>
    api.get<{ data: ActivityToken[] }>('/admin/tokens', { params }).then((r) => r.data.data),
  create: (body: { activity_id: string; expires_at: string; max_claims?: number | null }) =>
    api.post<{ data: ActivityToken }>('/admin/tokens', body).then((r) => r.data.data),
  update: (id: string, body: { expires_at?: string; is_active?: boolean; max_claims?: number | null }) =>
    api.put<{ data: ActivityToken }>(`/admin/tokens/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/admin/tokens/${id}`),
};

// ---------- projects & layers ----------
export const projectApi = {
  my: () => api.get<{ data: Project[] }>('/my/projects').then((r) => r.data.data),
  create: (body: { name: string; activity_id: string; region_id: string }) =>
    api.post<{ data: Project }>('/my/projects', body).then((r) => r.data.data),
  detail: (id: string) => api.get<{ data: ProjectDetail }>(`/my/projects/${id}`).then((r) => r.data.data),
  infrastructures: (id: string) => api.get<{ data: InfraMarkerData[] }>(`/my/projects/${id}/infrastructures`).then((r) => r.data.data),
  update: (id: string, body: { name?: string; status?: string }) =>
    api.put<{ data: Project }>(`/my/projects/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/my/projects/${id}`),
  adminList: (params?: Record<string, string>) =>
    api.get<{ data: Project[] }>('/admin/projects', { params }).then((r) => r.data.data),
  adminUpdate: (id: string, body: { name?: string; status?: string }) =>
    api.put<{ data: Project }>(`/admin/projects/${id}`, body).then((r) => r.data.data),
  adminRemove: (id: string) => api.delete(`/admin/projects/${id}`),
};

export const layerApi = {
  list: (projectId: string) =>
    api.get<{ data: ProjectLayer[] }>(`/my/projects/${projectId}/layers`).then((r) => r.data.data),
  upload: (projectId: string, file: Blob, name: string) => {
    const fd = new FormData();
    fd.append('file', file, name.endsWith('.geojson') ? name : `${name}.geojson`);
    fd.append('name', name.replace(/\.(geo)?json$|\.zip$/i, ''));
    return api.post<{ data: ProjectLayer }>(`/my/projects/${projectId}/layers`, fd).then((r) => r.data.data);
  },
  geojson: (layerId: string) =>
    api.get<GeoJSON.FeatureCollection>(`/layers/${layerId}/geojson`).then((r) => r.data),
  update: (id: string, body: Partial<Pick<ProjectLayer, 'name' | 'style' | 'sortOrder'>> & { is_visible?: boolean; sort_order?: number; style?: unknown }) =>
    api.put<{ data: ProjectLayer }>(`/layers/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/layers/${id}`),
};

// ---------- users (admin) ----------
export const userApi = {
  list: () => api.get<{ data: User[] }>('/admin/users').then((r) => r.data.data),
  create: (body: { name: string; username: string; email?: string; password: string; role: string }) =>
    api.post<{ data: User }>('/admin/users', body).then((r) => r.data.data),
  update: (id: string, body: Partial<{ name: string; email: string; password: string; role: string; is_active: boolean }>) =>
    api.put<{ data: User }>(`/admin/users/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/admin/users/${id}`),
};

// ---------- export & import (admin) ----------
export async function downloadBlob(url: string, params?: Record<string, string>): Promise<void> {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data as Blob);
  a.download = match?.[1] ?? 'download';
  a.click();
  URL.revokeObjectURL(a.href);
}

export const dashboardApi = {
  get: () => api.get<{ data: DashboardData }>('/admin/dashboard').then((r) => r.data.data),
};

export const auditApi = {
  list: (params: { page?: number; entity?: string }) =>
    api
      .get<{ data: AuditLogRow[]; meta: { page: number; total_pages: number; total: number } }>('/admin/audit-logs', {
        params,
      })
      .then((r) => r.data),
};

export const importApi = {
  validate: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<{
        data: {
          upload_id: string;
          valid_rows: number;
          invalid_rows: { row: number; errors: string[] }[];
          summary: { total: number; valid: number; invalid: number };
        };
      }>('/admin/import/infrastructures/validate', fd)
      .then((r) => r.data.data);
  },
  commit: (upload_id: string) =>
    api
      .post<{ data: { saved: number; failed: number; failed_download_url: string | null } }>(
        '/admin/import/infrastructures/commit',
        { upload_id },
      )
      .then((r) => r.data.data),
};
