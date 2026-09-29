import { FAIRNESS_MIN_CASES, fairnessFrom } from './fairness';

// Test inputs only: made-up figures to exercise the calculation. The app
// never shows figures that were not stored from a real evaluation run.
const evaluation = (byGroup: unknown) => ({
  testSet: { name: 'SYNTHETIC test fixture', cases: 400 },
  byGroup,
});

describe('fairnessFrom', () => {
  it('needs stored per-group figures', () => {
    expect(fairnessFrom(null)).toBeNull();
    expect(fairnessFrom({ overall: { auc: 0.9 } })).toBeNull();
    expect(fairnessFrom(evaluation([]))).toBeNull();
    expect(fairnessFrom(evaluation({ age: 'x' }))).toBeNull();
  });

  it('flags an AUC gap above 0.05 between groups', () => {
    const report = fairnessFrom(
      evaluation({
        region: {
          urban: { auc: 0.91, cases: 120 },
          'peri-urban': { auc: 0.89, cases: 80 },
          rural: { auc: 0.84, cases: 90 },
        },
      }),
    )!;
    expect(report.flagged).toBe(true);
    expect(report.dimensions[0]).toMatchObject({
      name: 'region',
      aucGap: 0.07,
      flagged: true,
    });
    expect(report.dimensions[0].note).toContain('remediation');
  });

  it('does not flag a gap of exactly 0.05 or less', () => {
    const report = fairnessFrom(
      evaluation({
        age: {
          '<50': { auc: 0.9, cases: 40 },
          '50-64': { auc: 0.88, cases: 150 },
          '>=65': { auc: 0.85, cases: 210 },
        },
      }),
    )!;
    expect(report.dimensions[0]).toMatchObject({
      aucGap: 0.05,
      flagged: false,
    });
    expect(report.flagged).toBe(false);
  });

  it('leaves out groups with too few cases or missing figures, and says why', () => {
    const report = fairnessFrom(
      evaluation({
        stage: {
          localised: { auc: 0.92, cases: 200 },
          advanced: { auc: 0.7, cases: FAIRNESS_MIN_CASES - 1 },
          unknown: { cases: 50 },
          odd: { auc: 1.4, cases: 60 },
          uncounted: { auc: 0.9 },
        },
      }),
    )!;
    const stage = report.dimensions[0];
    expect(stage.groups.map((g) => [g.name, g.compared])).toEqual([
      ['localised', true],
      ['advanced', false],
      ['unknown', false],
      ['odd', false],
      ['uncounted', false],
    ]);
    expect(stage.groups[1].reason).toContain('Too few test cases (29');
    expect(stage.groups[2].reason).toBe('No AUC stored for this group.');
    expect(stage.groups[4].reason).toBe(
      'The number of test cases is not stored.',
    );
    // Only one group left: nothing to compare, nothing flagged.
    expect(stage).toMatchObject({ aucGap: null, flagged: false });
    expect(stage.note).toContain('cannot be compared');
  });

  it('reports each dimension separately', () => {
    const report = fairnessFrom(
      evaluation({
        age: {
          '<50': { auc: 0.9, cases: 50 },
          '>=65': { auc: 0.89, cases: 50 },
        },
        equipment: {
          'scanner A': { auc: 0.93, cases: 60 },
          'scanner B': { auc: 0.8, cases: 60 },
        },
      }),
    )!;
    expect(report.dimensions.map((d) => [d.name, d.flagged])).toEqual([
      ['age', false],
      ['equipment', true],
    ]);
    expect(report.flagged).toBe(true);
    expect(report).toMatchObject({ threshold: 0.05, minCases: 30 });
  });
});
