# Access matrix

Generated from the code (`npm run access:matrix`); the quality gate fails if it is out of date or breaks a review rule
(`src/gateway/access/access-matrix.ts`). "Default roles" use the default permissions; administrators can change a
role's permissions, within the locks described in [security.md](security.md). Every route not marked public needs a
valid access token, and the account must be active.

66 routes.

| Method | Path | Rule | Default roles | Notes |
|---|---|---|---|---|
| GET | `/api/v1/admin/audit-logs` | `audit:read` | ADMIN |  |
| GET | `/api/v1/admin/audit-logs/verify` | `audit:read` | ADMIN |  |
| GET | `/api/v1/admin/facilities` | `user:manage` | ADMIN |  |
| GET | `/api/v1/admin/patient-accounts` | `patient_account:link` | ADMIN |  |
| POST | `/api/v1/admin/patient-accounts/:userId/link` | `patient_account:link` | ADMIN |  |
| POST | `/api/v1/admin/patient-accounts/:userId/match` | `patient_account:link` | ADMIN |  |
| POST | `/api/v1/admin/patient-accounts/:userId/unlink` | `patient_account:link` | ADMIN |  |
| GET | `/api/v1/admin/permissions` | `user:manage` | ADMIN |  |
| GET | `/api/v1/admin/roles` | `user:manage` | ADMIN |  |
| PUT | `/api/v1/admin/roles/:name/permissions` | `role:manage` | ADMIN |  |
| POST | `/api/v1/admin/roles/:name/reset` | `role:manage` | ADMIN |  |
| GET | `/api/v1/ai-jobs` | `ai:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/ai-jobs/:id` | `ai:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/ai-jobs/:id/explanations` | `ai:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/ai/models` | `ai:models:read` | CLINICIAN, PATHOLOGIST, ADMIN |  |
| GET | `/api/v1/ai/models/:id/evaluation` | `ai:models:read` | CLINICIAN, PATHOLOGIST, ADMIN |  |
| POST | `/api/v1/auth/change-password` | any signed-in account | PATIENT, CLINICIAN, PATHOLOGIST, ADMIN | allowed before the first password change |
| POST | `/api/v1/auth/forgot-password` | public | – | stricter sign-in rate limit |
| POST | `/api/v1/auth/login` | public | – | stricter sign-in rate limit |
| POST | `/api/v1/auth/logout` | any signed-in account | PATIENT, CLINICIAN, PATHOLOGIST, ADMIN | allowed before the first password change |
| POST | `/api/v1/auth/refresh` | public | – |  |
| POST | `/api/v1/auth/register` | public | – | stricter sign-in rate limit |
| POST | `/api/v1/auth/reset-password` | public | – | stricter sign-in rate limit |
| GET | `/api/v1/clinical-records/:id` | `clinical:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/explanations/:id/content` | `ai:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/fhir/export` | `fhir:export` | ADMIN |  |
| POST | `/api/v1/fhir/export/push` | `fhir:export` | ADMIN |  |
| GET | `/api/v1/fhir/export/summary` | `fhir:export` | ADMIN |  |
| GET | `/api/v1/health` | public | – |  |
| GET | `/api/v1/health/ready` | public | – |  |
| GET | `/api/v1/histopathology/:id` | `histopathology:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/histopathology/:id/content` | `histopathology:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/histopathology/:id/review` | `histopathology:review` | PATHOLOGIST |  |
| GET | `/api/v1/histopathology/review-queue` | `histopathology:review` | PATHOLOGIST |  |
| GET | `/api/v1/imaging/:id` | `imaging:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/imaging/:id/content` | `imaging:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/notifications` | `notification:read` | PATIENT, CLINICIAN, PATHOLOGIST, ADMIN |  |
| POST | `/api/v1/notifications/:id/read` | `notification:read` | PATIENT, CLINICIAN, PATHOLOGIST, ADMIN |  |
| POST | `/api/v1/notifications/read-all` | `notification:read` | PATIENT, CLINICIAN, PATHOLOGIST, ADMIN |  |
| GET | `/api/v1/patients` | `patient:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/patients` | `patient:create` | CLINICIAN |  |
| GET | `/api/v1/patients/:id` | `patient:read` | CLINICIAN, PATHOLOGIST |  |
| PATCH | `/api/v1/patients/:id` | `patient:update` | CLINICIAN |  |
| GET | `/api/v1/patients/:id/ai-jobs` | `ai:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/patients/:id/ai-jobs` | `ai:request` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/patients/:id/clinical-records` | `clinical:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/patients/:id/clinical-records` | `clinical:create` | CLINICIAN |  |
| GET | `/api/v1/patients/:id/consents` | `consent:manage` | CLINICIAN |  |
| POST | `/api/v1/patients/:id/consents` | `consent:manage` | CLINICIAN |  |
| POST | `/api/v1/patients/:id/consents/:consentId/withdraw` | `consent:manage` | CLINICIAN |  |
| GET | `/api/v1/patients/:id/histopathology` | `histopathology:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/patients/:id/histopathology` | `histopathology:submit` | PATHOLOGIST |  |
| GET | `/api/v1/patients/:id/imaging` | `imaging:read` | CLINICIAN, PATHOLOGIST |  |
| POST | `/api/v1/patients/:id/imaging` | `imaging:upload` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/patients/me` | `patient:read_self` | PATIENT |  |
| GET | `/api/v1/patients/me/clinical-records` | `clinical:read_self` | PATIENT |  |
| GET | `/api/v1/patients/me/consents` | `consent:read_self` | PATIENT |  |
| POST | `/api/v1/patients/me/consents/:consentId/withdraw` | `consent:withdraw_self` | PATIENT |  |
| POST | `/api/v1/sync` | `sync:write` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/sync/changes` | `clinical:read` + `patient:read` | CLINICIAN, PATHOLOGIST |  |
| GET | `/api/v1/users` | `user:manage` | ADMIN |  |
| POST | `/api/v1/users` | `role:manage` + `user:manage` | ADMIN |  |
| GET | `/api/v1/users/:id` | `user:manage` | ADMIN |  |
| PATCH | `/api/v1/users/:id` | `user:manage` | ADMIN |  |
| POST | `/api/v1/users/:id/reset-password` | `user:manage` | ADMIN |  |
| GET | `/api/v1/users/me` | any signed-in account | PATIENT, CLINICIAN, PATHOLOGIST, ADMIN | allowed before the first password change |
