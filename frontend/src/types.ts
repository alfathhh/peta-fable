export interface User {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: 'admin' | 'petugas';
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isActive: boolean;
}

export interface RegionOption {
  region_id: string;
  name: string;
}

export interface RegionSearchResult {
  region_id: string;
  level: string;
  name: string;
  path_name: string;
  bbox: [number, number, number, number] | null;
}

export interface RegionDetail {
  region_id: string;
  level: string;
  name: string;
  bbox: [number, number, number, number] | null;
  infrastructure_stats: { category_id: string; name: string; icon: string; color: string; count: number }[];
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface InfraMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isOutsideRegion: boolean;
  approvalStatus: ApprovalStatus;
  approvalNote?: string | null;
  category: { id: string; name: string; icon: string; color: string };
}

export interface RegionStat {
  region_id: string;
  count: number;
}

export interface DashboardData {
  totals: {
    active_officers: number;
    infrastructures: number;
    approved: number;
    pending_approval: number;
    rejected: number;
    outside_region: number;
    added_7d: number;
    active_projects: number;
    activities: number;
    active_tokens: number;
  };
  coverage: { total_kecamatan: number; covered_kecamatan: number };
  by_category: { category_id: string; name: string; icon: string; color: string; count: number }[];
  by_kecamatan: { region_id: string; name: string; count: number }[];
  latest: {
    id: string;
    name: string;
    category: { name: string; icon: string; color: string };
    username: string;
    approval_status: ApprovalStatus;
    created_at: string;
  }[];
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  username: string | null;
  role: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface InfraDetail extends InfraMarkerData {
  description: string | null;
  photo_url: string | null;
  /** URL foto versi kecil (?size=thumb) untuk popup peta; fallback ke photo_url bila tidak ada. */
  photo_thumb_url: string | null;
  gpsAccuracyM: number | null;
  region_names: Record<string, string>;
  gmaps_url: string;
  idkab: string | null;
  idkec: string | null;
  iddesa: string | null;
  idsls: string | null;
  idsubsls: string | null;
  userId: string;
  projectId: string | null;
  createdAt: string;
  user?: { id: string; name: string; username: string };
  project?: { id: string; name: string } | null;
}

export interface MyActivity {
  activity_id: string;
  name: string;
  description: string | null;
  claimed_at: string;
  token_expires_at: string;
  token_is_active: boolean;
}

export interface Activity {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count?: { tokens: number; projects: number };
}

export interface ActivityToken {
  id: string;
  token: string;
  activityId: string;
  expiresAt: string;
  maxClaims: number | null;
  claimsCount: number;
  isActive: boolean;
  createdAt: string;
  activity?: { id: string; name: string };
  _count?: { claims: number };
}

export interface LayerStyle {
  mode: 'outline' | 'fill';
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  label: { field: string | null; fontSize: number; fontColor: string } | null;
}

export interface ProjectLayer {
  id: string;
  projectId: string;
  name: string;
  featureCount: number;
  style: LayerStyle;
  isVisible: boolean;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  userId: string;
  activityId: string;
  regionId: string;
  regionLevel: string;
  status: string;
  createdAt: string;
  region_name?: string;
  activity?: { id: string; name: string };
  user?: { id: string; name: string; username: string };
  _count?: { infrastructures: number; layers: number };
}

export interface ProjectDetail extends Project {
  region: { regionId: string; level: string; name: string; bbox: [number, number, number, number] | null } | null;
  layers: ProjectLayer[];
  is_expired: boolean;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
