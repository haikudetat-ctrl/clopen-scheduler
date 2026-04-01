'use client';

import type { ScheduleIssue } from '../../../lib/scheduling/analyzeSchedule';

type AnalyzePanelProps = {
  issues: ScheduleIssue[];
};

const SEVERITY_ORDER: Array<ScheduleIssue['severity']> = ['high', 'medium', 'low'];
const SEVERITY_STYLES: Record<ScheduleIssue['severity'], string> = {
  high: 'border-red-200 bg-red-50 text-red-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-blue-200 bg-blue-50 text-blue-800'
};

export default function AnalyzePanel({ issues }: AnalyzePanelProps) {
  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    issues: issues.filter((issue) => issue.severity === severity)
  })).filter((group) => group.issues.length > 0);

  if (issues.length === 0) {
    return (
      <aside className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Schedule Analysis</h2>
        <p className="mt-2 text-sm text-gray-600">
          Click Analyze Schedule to detect fatigue, imbalance, utilization, and coverage risks.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Schedule Analysis</h2>
      <div className="mt-3 space-y-3">
        {grouped.map((group) => (
          <section key={group.severity}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {group.severity}
            </h3>
            <div className="space-y-1">
              {group.issues.map((issue, index) => (
                <div
                  key={`${group.severity}-${index}-${issue.message}`}
                  className={`rounded border px-2 py-1 text-sm ${SEVERITY_STYLES[group.severity]}`}
                >
                  {issue.message}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
