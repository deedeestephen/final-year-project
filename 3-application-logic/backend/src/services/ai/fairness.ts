/*
 * Fairness monitoring (proposal §3.7, FR-11): AI performance compared across
 * subgroups (age group, region, disease stage, imaging equipment). A gap in
 * AUC above 0.05 between the subgroups of one dimension is flagged for
 * remediation. Only figures from a stored evaluation run are used; nothing
 * is estimated, and a group with too few test cases is listed but not
 * compared.
 */

/** The proposal's threshold: an AUC gap above this is flagged. */
export const FAIRNESS_AUC_GAP = 0.05;
/** Below this many test cases a group's AUC is too unstable to compare. */
export const FAIRNESS_MIN_CASES = 30;

export interface FairnessGroup {
  name: string;
  auc: number | null;
  cases: number | null;
  compared: boolean;
  /** Why the group was left out of the comparison. */
  reason: string | null;
}

export interface FairnessDimension {
  name: string;
  groups: FairnessGroup[];
  /** Highest minus lowest AUC of the compared groups, to 3 decimals. */
  aucGap: number | null;
  flagged: boolean;
  note: string | null;
}

export interface FairnessReport {
  threshold: number;
  minCases: number;
  dimensions: FairnessDimension[];
  /** True when any dimension is flagged. */
  flagged: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function group(name: string, raw: unknown): FairnessGroup {
  const figures = isRecord(raw) ? raw : {};
  const auc =
    typeof figures.auc === 'number' && figures.auc >= 0 && figures.auc <= 1
      ? figures.auc
      : null;
  const cases =
    typeof figures.cases === 'number' &&
    Number.isInteger(figures.cases) &&
    figures.cases >= 0
      ? figures.cases
      : null;
  let reason: string | null = null;
  if (auc === null) reason = 'No AUC stored for this group.';
  else if (cases === null) reason = 'The number of test cases is not stored.';
  else if (cases < FAIRNESS_MIN_CASES)
    reason = `Too few test cases (${cases}; at least ${FAIRNESS_MIN_CASES} are needed to compare).`;
  return { name, auc, cases, compared: reason === null, reason };
}

/**
 * The fairness report for a stored evaluation, or null when the evaluation
 * has no per-group figures (`byGroup`, see docs/ai-model-integration-guide.md).
 */
export function fairnessFrom(evaluation: unknown): FairnessReport | null {
  if (!isRecord(evaluation) || !isRecord(evaluation.byGroup)) return null;
  const dimensions: FairnessDimension[] = [];
  for (const [name, raw] of Object.entries(evaluation.byGroup)) {
    if (!isRecord(raw)) continue;
    const groups = Object.entries(raw).map(([g, figures]) => group(g, figures));
    const aucs = groups.filter((g) => g.compared).map((g) => g.auc as number);
    if (aucs.length < 2) {
      dimensions.push({
        name,
        groups,
        aucGap: null,
        flagged: false,
        note: 'Fewer than two groups have enough test cases, so they cannot be compared.',
      });
      continue;
    }
    // Rounded to the 3 decimals shown, so 0.90 - 0.85 is exactly 0.05 (not
    // 0.05000000000000004) and is not flagged.
    const gap =
      Math.round((Math.max(...aucs) - Math.min(...aucs)) * 1000) / 1000;
    const flagged = gap > FAIRNESS_AUC_GAP;
    dimensions.push({
      name,
      groups,
      aucGap: gap,
      flagged,
      note: flagged
        ? `The AUC gap is above ${FAIRNESS_AUC_GAP}: remediation is needed before relying on this model for all groups.`
        : null,
    });
  }
  if (dimensions.length === 0) return null;
  return {
    threshold: FAIRNESS_AUC_GAP,
    minCases: FAIRNESS_MIN_CASES,
    dimensions,
    flagged: dimensions.some((d) => d.flagged),
  };
}
