import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../../src/config/repo-root';
import type { Stats } from './load';

/*
 * Prints the tables for docs/performance.md from a Phase 17 results file,
 * so the document quotes the measurement exactly.
 *   npm run perf:report            (newest file in var/perf/)
 *   npm run perf:report -- <file>
 */

interface Load {
  users: number;
  requestsPerSecond: number;
  byRequest: Record<string, Stats>;
  statuses: Record<string, number>;
}
interface Ai {
  jobs: number;
  failed: number;
  endToEndMs: { p50: number; p95: number; max: number };
  serverMs: { p50: number; p95: number; max: number };
}

const dir = path.join(repoRoot(), 'var', 'perf');
const file =
  process.argv[2] ??
  path.join(
    dir,
    readdirSync(dir)
      .filter((f) => f.startsWith('phase17-'))
      .sort()
      .at(-1)!,
  );
const r = JSON.parse(readFileSync(file, 'utf8')) as {
  machine: Record<string, string | number>;
  settings: { users: number; measureMs: number };
  startup: { aiReadyMs: number; backendReadyMs: number };
  login: Stats & { totalSeconds: number; concurrency: number };
  baseline: Load;
  main: Load;
  stress: Load;
  aiUnderLoad: Ai;
  aiBurst: Ai & { maxConcurrentJobs: number };
  syncStress: {
    phones: number;
    changesPerPhone: number;
    first: Stats;
    resend: Stats;
    applied: number;
    replayedOnResend: number;
    patientsCreated: number;
  };
};

const ms = (v: number) => `${v.toLocaleString('en-GB')} ms`;
const out: string[] = [];
const line = (s = '') => out.push(s);

line(`Source: \`var/perf/${path.basename(file)}\``);
line();
line(
  `Machine: ${r.machine.os}; ${r.machine.cpus}; ${r.machine.memoryGb} GB memory ` +
    `(${r.machine.freeMemoryGbAtEnd} GB free at the end); Node ${r.machine.node}.`,
);
line();

const loadTable = (title: string, l: Load) => {
  line(
    `**${title}:** ${l.users} users, about **${l.requestsPerSecond} requests per second**.`,
  );
  line();
  line('| Request | Count | Errors | P50 | P95 | P99 | Max |');
  line('|---|---|---|---|---|---|---|');
  for (const [name, s] of Object.entries(l.byRequest)) {
    const label = name === 'all' ? '**All requests**' : `\`${name}\``;
    line(
      `| ${label} | ${s.count} | ${s.errors} | ${ms(s.p50)} | ${ms(s.p95)} | ${ms(s.p99)} | ${ms(s.max)} |`,
    );
  }
  line();
  line(
    `Status codes: ${Object.entries(l.statuses)
      .map(([k, v]) => `${k} × ${v}`)
      .join(', ')}.`,
  );
  line();
};

loadTable('Baseline', r.baseline);
loadTable('Main run', r.main);
loadTable('Stress', r.stress);

const aiRow = (label: string, a: Ai) =>
  line(
    `| ${label} | ${a.jobs} | ${a.failed} | ${ms(a.endToEndMs.p50)} | ${ms(a.endToEndMs.p95)} | ${ms(a.endToEndMs.max)} | ${ms(a.serverMs.p50)} | ${ms(a.serverMs.p95)} |`,
  );
line(
  '| AI analyses | Jobs | Failed | End to end P50 | End to end P95 | Max | Server P50 | Server P95 |',
);
line('|---|---|---|---|---|---|---|---|');
aiRow('One a second, during the main run', r.aiUnderLoad);
aiRow(`20 at once (${r.aiBurst.maxConcurrentJobs} run at a time)`, r.aiBurst);
line();

const s = r.syncStress;
line(
  `**Sync:** ${s.phones} phones × ${s.changesPerPhone} changes at once: P50 ${ms(s.first.p50)}, ` +
    `P95 ${ms(s.first.p95)}, max ${ms(s.first.max)}, ${s.first.errors} errors; ` +
    `${s.applied} changes saved, ${s.patientsCreated} new patients. Sent again: P95 ${ms(s.resend.p95)}, ` +
    `${s.replayedOnResend} of ${s.applied} recognised as already saved.`,
);
line();
line(
  `**Sign-in:** ${r.login.count} sign-ins, ${r.login.concurrency} at a time: P50 ${ms(r.login.p50)}, ` +
    `P95 ${ms(r.login.p95)}; all done in ${r.login.totalSeconds} s.`,
);
line();
line(
  `**Start-up:** backend ready in ${ms(r.startup.backendReadyMs)} (production build, databases checked, AI service reachable); ` +
    `AI service ready in ${ms(r.startup.aiReadyMs)}.`,
);

console.log(out.join('\n'));
