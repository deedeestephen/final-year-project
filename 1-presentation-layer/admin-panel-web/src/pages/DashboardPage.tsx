import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { adminApi, type Activity, type ActivityDays } from '../api/admin';
import { BarList, LineChart, StackedBar } from '../components/charts';
import { formatCount } from '../components/chart-format';
import { Notice } from '../components/ui';
import { errorMessage } from '../components/messages';

const PERIODS: { days: ActivityDays; label: string }[] = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const ROLE_LABELS: Record<string, string> = {
  CLINICIAN: 'Clinicians',
  PATHOLOGIST: 'Pathologists',
  PATIENT: 'Patients',
  ADMIN: 'Administrators',
};

/** Plain words for what someone did in the phone app. */
const ACTIONS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.register': 'Created an account',
  'auth.password_change': 'Changed their password',
  'auth.refresh': 'Continued a session',
  'patient.created': 'Registered a patient',
  'patient.updated': 'Updated a patient',
  'patient.read': 'Opened a patient',
  'patient.search': 'Searched patients',
  'clinical_record.created': 'Added a screening record',
  'clinical_record.list': 'Viewed screening records',
  'clinical_record.read_self': 'Viewed their own results',
  'consent.granted': 'Recorded a consent',
  'consent.withdrawn': 'Withdrew a consent',
  'imaging.uploaded': 'Uploaded a scan',
  'histopathology.uploaded': 'Uploaded a slide',
  'histopathology.reviewed': 'Reviewed a slide',
  'ai_job.requested': 'Asked for an AI analysis',
  'ai_report.read': 'Opened an AI report',
  'sync.pull': 'Downloaded updates',
  'access.denied': 'Was refused access',
};

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
};

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{formatCount(value)}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

/**
 * What is happening in the apps: counts from the audit log and the phones'
 * sync log. Counts and staff actions only, never patient names or clinical
 * values. Opening the dashboard is recorded in the audit log.
 */
export function DashboardPage() {
  const [days, setDays] = useState<ActivityDays>(7);
  const activity = useQuery({
    queryKey: ['activity', days],
    queryFn: () => adminApi.activity(days),
    placeholderData: (previous) => previous,
  });
  const a: Activity | undefined = activity.data;
  const reloading = activity.isFetching && !activity.isPending;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="lead">
            What is happening in the phone app and on this website. Counts only:
            no patient names or results.
          </p>
        </div>
        <button
          onClick={() => void activity.refetch()}
          disabled={activity.isFetching}
        >
          <RefreshCw size={18} aria-hidden="true" />
          {activity.isFetching ? 'Updating…' : 'Update'}
        </button>
      </div>

      <div className="toolbar">
        <div className="segmented fill" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {activity.isError && (
        <Notice kind="error">{errorMessage(activity.error)}</Notice>
      )}
      {activity.isPending && <p className="muted">Loading…</p>}

      {a && (
        <div className={`dashboard${reloading ? ' reloading' : ''}`}>
          <section
            className="card hero-card"
            aria-label="Phone app at a glance"
          >
            <div className="hero-icon" aria-hidden="true">
              <Smartphone size={28} />
            </div>
            <div>
              <span className="stat-label">Active in the phone app</span>
              <span className="hero-value">
                {formatCount(a.totals.activePhoneUsers)}
              </span>
              <span className="stat-note">
                people · {formatCount(a.totals.activePhones)} phone
                {a.totals.activePhones === 1 ? '' : 's'} synced ·{' '}
                {formatCount(a.totals.activeUsers)} active in all
              </span>
            </div>
          </section>

          <div className="stat-row">
            <Stat
              label="Sign-ins"
              value={a.totals.signIns}
              note={`${formatCount(a.totals.failedSignIns)} failed`}
            />
            <Stat
              label="Patients registered"
              value={a.totals.patientsRegistered}
            />
            <Stat label="Screening records" value={a.totals.screeningRecords} />
            <Stat
              label="AI analyses"
              value={a.totals.aiRequested}
              note={`${formatCount(a.totals.aiCompleted)} finished`}
            />
            <Stat label="Scans and slides" value={a.totals.uploads} />
            <Stat
              label="Consents recorded"
              value={a.totals.consentsGranted}
              note={`${formatCount(a.totals.consentsWithdrawn)} withdrawn`}
            />
          </div>

          <section className="card">
            <h2 className="card-title">Activity per day</h2>
            <p className="muted">Days in Zambian time.</p>
            <LineChart
              title="Activity per day"
              dates={a.daily.map((d) => d.date)}
              series={[
                {
                  key: 'signIns',
                  label: 'Sign-ins',
                  color: 'var(--series-1)',
                  values: a.daily.map((d) => d.signIns),
                },
                {
                  key: 'synced',
                  label: 'Changes synced from phones',
                  color: 'var(--series-2)',
                  values: a.daily.map((d) => d.syncedChanges),
                },
                {
                  key: 'records',
                  label: 'Screening records',
                  color: 'var(--series-3)',
                  values: a.daily.map((d) => d.screeningRecords),
                },
              ]}
            />
          </section>

          <div className="grid-2">
            <section className="card">
              <h2 className="card-title">Where activity comes from</h2>
              <p className="muted">Recorded actions, by app.</p>
              <StackedBar
                parts={a.byClient.map((c) => ({
                  key: c.name,
                  label:
                    c.name === 'mobile'
                      ? 'Phone app'
                      : c.name === 'web'
                        ? 'Admin website'
                        : 'Other',
                  color:
                    c.name === 'mobile'
                      ? 'var(--series-1)'
                      : c.name === 'web'
                        ? 'var(--series-2)'
                        : 'var(--series-other)',
                  value: c.count,
                }))}
              />
            </section>
            <section className="card">
              <h2 className="card-title">Offline sync health</h2>
              <p className="muted">
                Changes the phones sent after working offline.
              </p>
              <ul className="status-list">
                <li>
                  <CheckCircle2
                    size={20}
                    className="status-good"
                    aria-hidden="true"
                  />
                  <span>Saved</span>
                  <strong>{formatCount(a.sync.applied)}</strong>
                </li>
                <li>
                  <AlertTriangle
                    size={20}
                    className="status-warning"
                    aria-hidden="true"
                  />
                  <span>Conflicts (kept for a person to choose)</span>
                  <strong>{formatCount(a.sync.conflicts)}</strong>
                </li>
                <li>
                  <XCircle
                    size={20}
                    className="status-critical"
                    aria-hidden="true"
                  />
                  <span>Refused as invalid</span>
                  <strong>{formatCount(a.sync.rejected)}</strong>
                </li>
              </ul>
            </section>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2 className="card-title">Sign-ins by role</h2>
              <BarList
                color="var(--series-1)"
                empty="No sign-ins in this period."
                rows={a.signInsByRole.map((r) => ({
                  label: r.name
                    .split(',')
                    .map((n) => ROLE_LABELS[n] ?? n)
                    .join(' + '),
                  value: r.count,
                }))}
              />
            </section>
            <section className="card">
              <h2 className="card-title">Latest from the phone app</h2>
              {a.recentPhone.length === 0 ? (
                <p className="muted">Nothing from the phone app yet.</p>
              ) : (
                <ul className="feed">
                  {a.recentPhone.map((e) => (
                    <li key={e.seq}>
                      <span
                        className={`feed-dot ${e.outcome.toLowerCase()}`}
                        aria-hidden="true"
                      />
                      <span className="feed-text">
                        <strong>{ACTIONS[e.action] ?? e.action}</strong>
                        <span className="muted">
                          {e.actorEmail ?? 'Unknown account'}
                          {e.outcome !== 'SUCCESS' &&
                            ` · ${e.outcome === 'DENIED' ? 'refused' : 'failed'}`}
                        </span>
                      </span>
                      <time dateTime={e.occurredAt} className="muted">
                        {ago(e.occurredAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
