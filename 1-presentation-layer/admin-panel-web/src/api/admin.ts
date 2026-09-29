import { api } from './client';

export type Role = 'PATIENT' | 'CLINICIAN' | 'PATHOLOGIST' | 'ADMIN';

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: 'Patient',
  CLINICIAN: 'Clinician',
  PATHOLOGIST: 'Pathologist / Radiologist',
  ADMIN: 'Administrator',
};
export const ROLES = Object.keys(ROLE_LABELS) as Role[];

/** Roles that must belong to a facility (they see its patients). */
export const FACILITY_ROLES: Role[] = ['CLINICIAN', 'PATHOLOGIST'];

export interface User {
  id: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  roles: Role[];
  facilityId: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RoleInfo {
  name: Role;
  description: string;
  permissions: string[];
  customised: boolean;
  userCount: number;
  notAllowed: string[];
  required: string[];
}

export interface Permission {
  code: string;
  description: string;
}

export interface Facility {
  id: string;
  code: string;
  name: string;
  province: string;
  district: string;
}

export interface PatientAccount {
  userId: string;
  email: string;
  displayName: string;
  idDocumentType: 'NRC' | 'PASSPORT' | null;
  idNumberMasked: string | null;
  phoneMasked: string | null;
  linked: { patientId: string; mrn: string; facilityName: string } | null;
  createdAt: string;
}

export interface RecordMatch {
  patientId: string;
  mrn: string;
  facilityName: string;
  linkedToAnotherAccount: boolean;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') s.set(k, String(v));
  }
  const text = s.toString();
  return text ? `?${text}` : '';
};

export const adminApi = {
  users: (params: {
    q?: string;
    role?: Role;
    page?: number;
    pageSize?: number;
  }) => api.get<Page<User>>(`/users${qs(params)}`),
  user: (id: string) => api.get<User>(`/users/${id}`),
  createUser: (body: {
    email: string;
    displayName: string;
    roles: Role[];
    facilityId?: string;
  }) => api.post<{ user: User; temporaryPassword: string }>('/users', body),
  updateUser: (
    id: string,
    body: Partial<{
      roles: Role[];
      facilityId: string;
      status: 'ACTIVE' | 'DISABLED';
      unlock: boolean;
      displayName: string;
    }>,
  ) => api.patch<User>(`/users/${id}`, body),
  resetPassword: (id: string) =>
    api.post<{ temporaryPassword: string }>(`/users/${id}/reset-password`),
  /** Refused (409 HAS_CLINICAL_HISTORY) for accounts with clinical history. */
  deleteUser: (id: string) => api.delete<void>(`/users/${id}`),
  roles: () => api.get<RoleInfo[]>('/admin/roles'),
  permissions: () => api.get<Permission[]>('/admin/permissions'),
  setRolePermissions: (role: Role, permissions: string[]) =>
    api.put<RoleInfo>(`/admin/roles/${role}/permissions`, { permissions }),
  resetRole: (role: Role) => api.post<RoleInfo>(`/admin/roles/${role}/reset`),
  facilities: () => api.get<Facility[]>('/admin/facilities'),
  patientAccounts: (status: 'unlinked' | 'linked' | 'all', page = 1) =>
    api.get<Page<PatientAccount>>(
      `/admin/patient-accounts${qs({ status, page, pageSize: 50 })}`,
    ),
  match: (userId: string) =>
    api.post<RecordMatch>(`/admin/patient-accounts/${userId}/match`),
  link: (userId: string) =>
    api.post<PatientAccount>(`/admin/patient-accounts/${userId}/link`),
  unlink: (userId: string) =>
    api.post<PatientAccount>(`/admin/patient-accounts/${userId}/unlink`),
  fhirSummary: (purpose: ExportPurpose, facilityId?: string) =>
    api.get<FhirSummary>(`/fhir/export/summary${qs({ purpose, facilityId })}`),
  /** The de-identified FHIR R4 Bundle itself. */
  fhirExport: (purpose: ExportPurpose, facilityId?: string) =>
    api.post<Record<string, unknown>>('/fhir/export', {
      purpose,
      ...(facilityId ? { facilityId } : {}),
    }),
  fhirPush: (facilityId?: string) =>
    api.post<FhirPushResult>(
      '/fhir/export/push',
      facilityId ? { facilityId } : {},
    ),
  auditLogs: (filters: AuditFilters, page = 1) =>
    api.get<Page<AuditEntry>>(
      `/admin/audit-logs${qs({ ...filters, page, pageSize: 50 })}`,
    ),
  verifyAuditLog: () => api.get<AuditChain>('/admin/audit-logs/verify'),
  activity: (days: ActivityDays) =>
    api.get<Activity>(`/admin/activity${qs({ days })}`),
};

export type ActivityDays = 1 | 7 | 30 | 90;

export interface ActivityDay {
  date: string;
  signIns: number;
  screeningRecords: number;
  syncedChanges: number;
  aiRequested: number;
}

export interface Activity {
  days: ActivityDays;
  from: string;
  to: string;
  totals: {
    activeUsers: number;
    activePhoneUsers: number;
    activePhones: number;
    signIns: number;
    failedSignIns: number;
    patientsRegistered: number;
    screeningRecords: number;
    uploads: number;
    aiRequested: number;
    aiCompleted: number;
    consentsGranted: number;
    consentsWithdrawn: number;
    accessDenied: number;
  };
  daily: ActivityDay[];
  byClient: { name: 'mobile' | 'web' | 'other'; count: number }[];
  signInsByRole: { name: string; count: number }[];
  sync: { applied: number; conflicts: number; rejected: number };
  recentPhone: {
    seq: string;
    occurredAt: string;
    action: string;
    outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
    actorEmail: string | null;
    actorRole: string | null;
  }[];
}

export interface AuditFilters {
  action?: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';
  from?: string;
  to?: string;
}

export interface AuditEntry {
  seq: string;
  occurredAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  requestId: string | null;
  ip: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditChain {
  intact: boolean;
  entries: number;
  brokenAt: string | null;
  reason: string | null;
  checkedAt: string;
}

/** RESEARCH needs research-use consent; NATIONAL_EHR (SmartCare Pro) needs EHR-sharing consent. */
export type ExportPurpose = 'RESEARCH' | 'NATIONAL_EHR';

export interface FhirCounts {
  patients: number;
  screeningVisits: number;
  observations: number;
  pathologyReports: number;
  aiReports: number;
  aiReportsLeftOutMock: number;
}

export interface FhirSummary {
  purpose: ExportPurpose;
  patientsInScope: number;
  patientsWithConsent: number;
  consentRequired: 'RESEARCH_USE' | 'EHR_SHARING';
  willExport: FhirCounts;
  maxPatients: number;
  smartcareConfigured: boolean;
  smartcareHost: string | null;
}

export interface FhirPushResult {
  status: 'SENT';
  bundleId: string;
  httpStatus: number;
  receiverId: string | null;
  target: string;
  counts: FhirCounts;
}
