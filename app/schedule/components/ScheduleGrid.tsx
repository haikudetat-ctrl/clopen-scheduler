'use client';

import { useMemo } from 'react';
import type { ScheduleIssue } from '../../../lib/scheduling/analyzeSchedule';
import type {
  ScheduleAssignment,
  ShiftRequirement,
  ShiftTemplate,
  Staff
} from '../../../types/schedule';
import ShiftCell from './ShiftCell';

const DAY_COLUMNS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 }
];

type PositionBlock = {
  assignmentId: string;
  role: string;
  staffId: string | null;
  slotNumber: number;
};

type ScheduleGridProps = {
  staff: Staff[];
  shiftTemplates: ShiftTemplate[];
  shiftRequirements: ShiftRequirement[];
  assignments: ScheduleAssignment[];
  issues: ScheduleIssue[];
  onAssign: (assignmentId: string, staffId: string | null) => void;
};

function getTemplateDurationHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const diff = Math.max(endMinutes - startMinutes, 0);

  return diff / 60;
}

function getSeverityWeight(severity: ScheduleIssue['severity']): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

export default function ScheduleGrid({
  staff,
  shiftTemplates,
  shiftRequirements,
  assignments,
  issues,
  onAssign
}: ScheduleGridProps) {
  const staffById = useMemo(
    () =>
      staff.reduce<Record<string, Staff>>((acc, member) => {
        acc[member.id] = member;
        return acc;
      }, {}),
    [staff]
  );

  const templateById = useMemo(
    () =>
      shiftTemplates.reduce<Record<string, ShiftTemplate>>((acc, template) => {
        acc[template.id] = template;
        return acc;
      }, {}),
    [shiftTemplates]
  );

  const scheduledHoursByStaff = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const assignment of assignments) {
      if (!assignment.staff_id) {
        continue;
      }

      const template = templateById[assignment.template_id];
      if (!template) {
        continue;
      }

      totals[assignment.staff_id] =
        (totals[assignment.staff_id] ?? 0) +
        getTemplateDurationHours(template.start_time, template.end_time);
    }

    return totals;
  }, [assignments, templateById]);

  const issueSeverityByCell = useMemo(() => {
    const map: Record<string, ScheduleIssue['severity']> = {};

    for (const issue of issues) {
      const day = issue.context?.day;
      const templateId = issue.context?.template_id;
      if (day === undefined || !templateId) {
        continue;
      }

      const key = `${day}:${templateId}`;
      const current = map[key];
      if (!current || getSeverityWeight(issue.severity) > getSeverityWeight(current)) {
        map[key] = issue.severity;
      }
    }

    return map;
  }, [issues]);

  const getPositionsForCell = (day: number, templateId: string): PositionBlock[] => {
    const cellAssignments = assignments.filter(
      (assignment) => assignment.day === day && assignment.template_id === templateId
    );

    const templateRequirements = shiftRequirements.filter(
      (requirement) => requirement.template_id === templateId
    );

    const blocks: PositionBlock[] = [];

    for (const requirement of templateRequirements) {
      const roleAssignments = cellAssignments.filter((assignment) => assignment.role === requirement.role);

      for (let i = 0; i < requirement.required_count; i += 1) {
        const assignment = roleAssignments[i];
        if (!assignment) {
          continue;
        }

        blocks.push({
          assignmentId: assignment.id,
          role: requirement.role,
          staffId: assignment.staff_id,
          slotNumber: i + 1
        });
      }
    }

    return blocks;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-200 bg-gray-50 p-2 text-left font-medium">Shift</th>
            {DAY_COLUMNS.map((day) => (
              <th key={day.value} className="border border-gray-200 bg-gray-50 p-2 text-left font-medium">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shiftTemplates.map((template) => (
            <tr key={template.id}>
              <td className="border border-gray-200 bg-gray-50 p-2 align-top">
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-gray-600">
                  {template.start_time.slice(0, 5)}-{template.end_time.slice(0, 5)}
                </div>
              </td>
              {DAY_COLUMNS.map((day) => (
                <ShiftCell
                  key={`${template.id}-${day.value}`}
                  day={day.value}
                  shiftStart={template.start_time}
                  shiftEnd={template.end_time}
                  positions={getPositionsForCell(day.value, template.id)}
                  staffById={staffById}
                  scheduledHoursByStaff={scheduledHoursByStaff}
                  onAssign={onAssign}
                  highlightSeverity={issueSeverityByCell[`${day.value}:${template.id}`] ?? null}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
