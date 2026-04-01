'use client';

import { useState } from 'react';
import { analyzeSchedule, type ScheduleIssue } from '../../../lib/scheduling/analyzeSchedule';
import { supabase } from '../../../lib/supabaseClient';
import type {
  ScheduleAssignment,
  ShiftRequirement,
  ShiftTemplate,
  Staff
} from '../../../types/schedule';
import AnalyzePanel from './AnalyzePanel';
import ScheduleGrid from './ScheduleGrid';

type ScheduleWorkspaceProps = {
  staff: Staff[];
  shiftTemplates: ShiftTemplate[];
  shiftRequirements: ShiftRequirement[];
  initialAssignments: ScheduleAssignment[];
  analyzeButtonLabel?: string;
};

export default function ScheduleWorkspace({
  staff,
  shiftTemplates,
  shiftRequirements,
  initialAssignments,
  analyzeButtonLabel = 'Analyze Schedule'
}: ScheduleWorkspaceProps) {
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>(initialAssignments);
  const [issues, setIssues] = useState<ScheduleIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(null);
  const [analysisStale, setAnalysisStale] = useState(false);

  const handleAssign = async (assignmentId: string, staffId: string | null) => {
    setSaveError(null);
    setSavingAssignmentId(assignmentId);

    const previousStaffId = assignments.find((assignment) => assignment.id === assignmentId)?.staff_id ?? null;
    setAssignments((prev) =>
      prev.map((assignment) => (assignment.id === assignmentId ? { ...assignment, staff_id: staffId } : assignment))
    );
    if (issues.length > 0) {
      setAnalysisStale(true);
    }

    const { error } = await supabase
      .from('schedule_assignments')
      .update({ staff_id: staffId })
      .eq('id', assignmentId);

    if (error) {
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === assignmentId ? { ...assignment, staff_id: previousStaffId } : assignment
        )
      );
      setSaveError(error.message);
    }

    setSavingAssignmentId(null);
  };

  const handleAnalyze = () => {
    setIssues(
      analyzeSchedule({
        schedule_assignments: assignments,
        staff,
        shift_templates: shiftTemplates
      })
    );
    setAnalysisStale(false);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Live Schedule</h2>
          <p className="text-xs text-gray-600">Analyze catches fatigue, imbalance, utilization, and coverage risks.</p>
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
        >
          {analyzeButtonLabel}
        </button>
      </div>

      {analysisStale ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Schedule changed. Run Analyze Schedule again for updated insights.
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to save assignment: {saveError}
        </div>
      ) : null}
      {savingAssignmentId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Saving assignment...
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <ScheduleGrid
          staff={staff}
          shiftTemplates={shiftTemplates}
          shiftRequirements={shiftRequirements}
          assignments={assignments}
          issues={issues}
          onAssign={handleAssign}
        />
        <AnalyzePanel issues={issues} />
      </div>
    </section>
  );
}
