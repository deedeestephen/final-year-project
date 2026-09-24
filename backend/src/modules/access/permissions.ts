/**
 * Role-based access control catalogue (FR-01, UC-09).
 * Single source of truth: the database seed writes it, and the authorization
 * guard (Phase 4) checks against it. Roles get the minimum they need.
 */
export const PERMISSIONS = {
  'patient:create': 'Register a patient',
  'patient:read': 'Read patient records in own facility',
  'patient:update': 'Update patient records in own facility',
  'patient:read_self': "Read one's own patient profile",
  'clinical:create': 'Record clinical assessments (PSA, DRE, PI-RADS)',
  'clinical:read': 'Read clinical records in own facility',
  'clinical:read_self': "Read one's own screening records",
  'consent:manage': 'Capture or withdraw patient consent',
  'consent:read_self': "Read one's own consents",
  'consent:withdraw_self':
    "Withdraw one's own consent (unconditional right, proposal §3.7.1)",
  'imaging:upload': 'Upload imaging studies',
  'imaging:read': 'Read imaging studies',
  'histopathology:submit': 'Submit histopathology slides',
  'histopathology:read': 'Read histopathology records',
  'histopathology:review': 'Enter or confirm a pathology grading',
  'ai:request': 'Request an AI-assisted analysis',
  'ai:read': 'Read AI-assisted analysis reports',
  'ai:models:read': 'View AI model registry metadata',
  'ai:models:manage': 'Register, activate or retire AI models',
  'report:read_self': "Read one's own released reports",
  'chatbot:use': 'Use the education chatbot',
  'notification:read': "Read one's own notifications",
  'sync:write': 'Submit offline synchronisation batches',
  'user:manage': 'Create, modify and deactivate users',
  'role:manage': 'Assign roles to users and edit role permissions',
  'patient_account:link':
    "Link a patient's app account to their clinic record (matched by NRC)",
  'facility:manage': 'Manage facilities',
  'audit:read': 'Read the audit log',
  'fhir:export': 'Export de-identified FHIR R4 bundles',
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ROLES = ['PATIENT', 'CLINICIAN', 'PATHOLOGIST', 'ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  PATIENT: 'Patient using the app for education, consent and own reports',
  CLINICIAN:
    'Clinical officer, nurse or doctor managing patients and assessments',
  PATHOLOGIST:
    'Pathologist or radiologist reviewing imaging and histopathology',
  ADMIN: 'System administrator (no routine access to clinical data)',
};

export const ROLE_PERMISSIONS: Record<RoleName, readonly PermissionCode[]> = {
  PATIENT: [
    'patient:read_self',
    'clinical:read_self',
    'consent:read_self',
    'consent:withdraw_self',
    'report:read_self',
    'chatbot:use',
    'notification:read',
  ],
  CLINICIAN: [
    'patient:create',
    'patient:read',
    'patient:update',
    'clinical:create',
    'clinical:read',
    'consent:manage',
    'imaging:upload',
    'imaging:read',
    'histopathology:read',
    'ai:request',
    'ai:read',
    'ai:models:read',
    'chatbot:use',
    'notification:read',
    'sync:write',
  ],
  PATHOLOGIST: [
    'patient:read',
    'clinical:read',
    'imaging:upload',
    'imaging:read',
    'histopathology:submit',
    'histopathology:read',
    'histopathology:review',
    'ai:request',
    'ai:read',
    'ai:models:read',
    'notification:read',
    'sync:write',
  ],
  ADMIN: [
    'user:manage',
    'role:manage',
    'patient_account:link',
    'facility:manage',
    'audit:read',
    'ai:models:read',
    'ai:models:manage',
    'notification:read',
    'fhir:export',
  ],
};
