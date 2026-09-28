import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  adminApi,
  type ExportPurpose,
  type FhirCounts,
  type FhirPushResult,
} from '../api/admin';
import { ApiError } from '../api/client';
import { Dialog, Notice } from '../components/ui';
import { errorMessage } from '../components/messages';

const PURPOSES: { value: ExportPurpose; label: string; consent: string }[] = [
  {
    value: 'RESEARCH',
    label: 'Research',
    consent: 'agreed to research use of their data',
  },
  {
    value: 'NATIONAL_EHR',
    label: 'SmartCare Pro (national EHR)',
    consent: 'agreed to sharing with the national health record',
  },
];

const REMOVED = [
  'Names, phone numbers, emails, NRC and passport numbers',
  'Clinic record numbers, account ids and all internal ids',
  'Districts, facility names and codes (only the country and urban / rural are kept)',
  'Exact dates: only the year is kept, and ages from 90 are shown as "90 or older"',
  'Notes, other free text, and image and slide files',
];

/** Plain words for the export and SmartCare errors. */
function exportError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'FHIR_TARGET_NOT_CONFIGURED':
        return 'No SmartCare Pro address is set on the server, so nothing was sent.';
      case 'FHIR_TARGET_REJECTED':
        return 'SmartCare Pro refused the file. Its reason is in the audit log.';
      case 'FHIR_TARGET_UNREACHABLE':
        return 'SmartCare Pro could not be reached or had a problem. Nothing was saved there. Try again later.';
      case 'FHIR_TARGET_TIMED_OUT':
        return 'SmartCare Pro did not answer in time. Check with them before sending again.';
    }
  }
  return errorMessage(e);
}

/** Saves JSON as a file on this computer. */
function saveJsonFile(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/fhir+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * De-identified patient data in the HL7 FHIR R4 format (UC-08): a file for
 * research, or a send to SmartCare Pro. Only patients who gave the matching
 * consent are included; the server removes every direct identifier.
 */
export function FhirExportPage() {
  const [purpose, setPurpose] = useState<ExportPurpose>('RESEARCH');
  const [facilityId, setFacilityId] = useState('');
  const [message, setMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const facilities = useQuery({
    queryKey: ['facilities'],
    queryFn: adminApi.facilities,
  });
  const summary = useQuery({
    queryKey: ['fhir-summary', purpose, facilityId],
    queryFn: () => adminApi.fhirSummary(purpose, facilityId || undefined),
  });
  const choice = PURPOSES.find((p) => p.value === purpose)!;
  const s = summary.data;
  const counts: FhirCounts | undefined = s?.willExport;
  const tooMany = s ? s.patientsWithConsent > s.maxPatients : false;
  const nobody = s ? s.patientsWithConsent === 0 : true;

  const download = useMutation({
    mutationFn: () => adminApi.fhirExport(purpose, facilityId || undefined),
    onSuccess: (bundle) => {
      const name = `pca-mhealth-fhir-${purpose.toLowerCase()}-${today()}.json`;
      saveJsonFile(name, bundle);
      setMessage({
        kind: 'success',
        text: `Saved ${name} (${counts?.patients ?? 0} patients). The download was recorded in the audit log.`,
      });
    },
    onError: (e) => setMessage({ kind: 'error', text: exportError(e) }),
  });
  const send = useMutation({
    mutationFn: () => adminApi.fhirPush(facilityId || undefined),
    onSuccess: (r: FhirPushResult) =>
      setMessage({
        kind: 'success',
        text: `Sent to ${r.target}: ${r.counts.patients} patients. SmartCare Pro accepted it${r.receiverId ? ` (reference ${r.receiverId})` : ''}.`,
      }),
    onError: (e) => setMessage({ kind: 'error', text: exportError(e) }),
  });
  const busy = download.isPending || send.isPending;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>FHIR export</h1>
          <p className="lead">
            De-identified patient data in the international HL7 FHIR R4 format,
            for research or for Zambia&apos;s SmartCare Pro. Only patients who{' '}
            {choice.consent} are included.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Purpose">
          {PURPOSES.map((p) => (
            <button
              key={p.value}
              aria-pressed={purpose === p.value}
              onClick={() => {
                setPurpose(p.value);
                setMessage(null);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="export-facility">
          Facility
        </label>
        <select
          id="export-facility"
          value={facilityId}
          onChange={(e) => {
            setFacilityId(e.target.value);
            setMessage(null);
          }}
        >
          <option value="">All facilities</option>
          {facilities.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {summary.isError && (
        <Notice kind="error">{errorMessage(summary.error)}</Notice>
      )}

      <div className="card">
        <p className="card-title">What the file will contain</p>
        {summary.isPending ? (
          <p className="muted">Counting…</p>
        ) : s && counts ? (
          <>
            <p className="muted">
              <span className="num">{s.patientsWithConsent}</span> of{' '}
              <span className="num">{s.patientsInScope}</span> patients{' '}
              {choice.consent}.
            </p>
            <ul className="stats" aria-label="Will be exported">
              <li>
                <span className="num">{counts.patients}</span>
                <span className="stat-label">patients</span>
              </li>
              <li>
                <span className="num">{counts.screeningVisits}</span>
                <span className="stat-label">screening visits</span>
              </li>
              <li>
                <span className="num">{counts.observations}</span>
                <span className="stat-label">results and findings</span>
              </li>
              <li>
                <span className="num">{counts.pathologyReports}</span>
                <span className="stat-label">pathology reviews</span>
              </li>
              <li>
                <span className="num">{counts.aiReports}</span>
                <span className="stat-label">AI reports (research models)</span>
              </li>
            </ul>
            {counts.aiReportsLeftOutMock > 0 && (
              <Notice kind="info">
                {counts.aiReportsLeftOutMock} practice (mock) AI result
                {counts.aiReportsLeftOutMock === 1 ? ' is' : 's are'} left out.
                Practice results are never exported.
              </Notice>
            )}
            {tooMany && (
              <Notice kind="warning">
                More than {s.maxPatients} patients: too many for one file.
                Choose one facility at a time.
              </Notice>
            )}
          </>
        ) : null}
      </div>

      <div className="card">
        <p className="card-title">What is removed</p>
        <ul className="plain-list">
          {REMOVED.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="hint">
          Each person gets a code that stays the same between exports, so
          research can follow them over time without knowing who they are. Every
          export is recorded in the audit log.
        </p>
      </div>

      <div className="toolbar">
        <button
          className="primary"
          disabled={busy || nobody || tooMany}
          onClick={() => {
            setMessage(null);
            download.mutate();
          }}
        >
          {download.isPending ? 'Preparing…' : 'Download FHIR file (.json)'}
        </button>
        {purpose === 'NATIONAL_EHR' && (
          <button
            disabled={busy || nobody || tooMany || !s?.smartcareConfigured}
            onClick={() => {
              setMessage(null);
              setConfirmSend(true);
            }}
          >
            {send.isPending ? 'Sending…' : 'Send to SmartCare Pro'}
          </button>
        )}
      </div>
      {nobody && s && (
        <p className="hint">
          Nothing to export yet: no patient here has given this consent.
        </p>
      )}
      {purpose === 'NATIONAL_EHR' && s && !s.smartcareConfigured && (
        <p className="hint">
          Sending is off: no SmartCare Pro address is set on the server
          (SMARTCARE_FHIR_URL). The file can still be downloaded.
        </p>
      )}

      {confirmSend && s && (
        <Dialog
          title="Send to SmartCare Pro?"
          onClose={() => setConfirmSend(false)}
          actions={
            <>
              <button onClick={() => setConfirmSend(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  setConfirmSend(false);
                  send.mutate();
                }}
              >
                Send
              </button>
            </>
          }
        >
          <p>
            The de-identified records of {counts?.patients ?? 0} patients will
            be sent to {s.smartcareHost}. This is recorded in the audit log.
          </p>
        </Dialog>
      )}
    </>
  );
}
