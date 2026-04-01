import type { ScheduleAssignment, ShiftTemplate, Staff } from '../../types/schedule';

export type ScheduleIssue = {
  type: 'fatigue' | 'imbalance' | 'underutilized' | 'coverage';
  severity: 'low' | 'medium' | 'high';
  message: string;
  context?: {
    day?: number;
    template_id?: string;
    staff_id?: string;
  };
};

type AnalyzeInput = {
  schedule_assignments: ScheduleAssignment[];
  staff: Staff[];
  shift_templates: ShiftTemplate[];
};

const CRITICAL_ROLES = new Set(['bartender', 'cook', 'chef', 'manager']);
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SKILL_THRESHOLD = 2.5;

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function getSeverityWeight(severity: ScheduleIssue['severity']): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function toOneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function analyzeSchedule({
  schedule_assignments,
  staff,
  shift_templates
}: AnalyzeInput): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const templateById = shift_templates.reduce<Record<string, ShiftTemplate>>((acc, template) => {
    acc[template.id] = template;
    return acc;
  }, {});
  const staffById = staff.reduce<Record<string, Staff>>((acc, member) => {
    acc[member.id] = member;
    return acc;
  }, {});

  const latestEndTime = shift_templates.reduce((latest, template) => {
    const templateEnd = parseTimeToMinutes(template.end_time);
    return templateEnd > latest ? templateEnd : latest;
  }, 0);
  const closingTemplateIds = new Set(
    shift_templates
      .filter((template) => parseTimeToMinutes(template.end_time) === latestEndTime)
      .map((template) => template.id)
  );

  const scheduledHoursByStaff: Record<string, number> = {};
  const closingShiftsByStaff: Record<string, number> = {};
  const groupedByShift = new Map<string, ScheduleAssignment[]>();
  const groupedByShiftRole = new Map<string, ScheduleAssignment[]>();

  for (const assignment of schedule_assignments) {
    const shiftKey = `${assignment.day}:${assignment.template_id}`;
    const shiftRoleKey = `${assignment.day}:${assignment.template_id}:${assignment.role.toLowerCase()}`;
    groupedByShift.set(shiftKey, [...(groupedByShift.get(shiftKey) ?? []), assignment]);
    groupedByShiftRole.set(shiftRoleKey, [...(groupedByShiftRole.get(shiftRoleKey) ?? []), assignment]);

    if (!assignment.staff_id) {
      continue;
    }

    const template = templateById[assignment.template_id];
    if (!template) {
      continue;
    }

    const hours =
      (parseTimeToMinutes(template.end_time) - parseTimeToMinutes(template.start_time)) / 60;
    scheduledHoursByStaff[assignment.staff_id] = (scheduledHoursByStaff[assignment.staff_id] ?? 0) + hours;

    if (closingTemplateIds.has(assignment.template_id)) {
      closingShiftsByStaff[assignment.staff_id] = (closingShiftsByStaff[assignment.staff_id] ?? 0) + 1;
    }
  }

  for (const member of staff) {
    const hours = scheduledHoursByStaff[member.id] ?? 0;
    const closings = closingShiftsByStaff[member.id] ?? 0;

    if (hours > 40) {
      issues.push({
        type: 'fatigue',
        severity: 'high',
        message: `${member.name} is scheduled ${toOneDecimal(hours)} hours this week.`,
        context: { staff_id: member.id }
      });
    }

    if (closings >= 3) {
      issues.push({
        type: 'fatigue',
        severity: closings >= 4 ? 'high' : 'medium',
        message: `${member.name} is working ${closings} closing shifts this week.`,
        context: { staff_id: member.id }
      });
    }
  }

  for (const [shiftKey, shiftAssignments] of groupedByShift.entries()) {
    const [dayRaw, templateId] = shiftKey.split(':');
    const day = Number(dayRaw);
    const template = templateById[templateId];
    if (!template) {
      continue;
    }

    const assignedMembers = shiftAssignments
      .filter((assignment) => Boolean(assignment.staff_id))
      .map((assignment) => staffById[assignment.staff_id as string])
      .filter((member): member is Staff => Boolean(member));

    if (assignedMembers.length > 0) {
      const avgSkill =
        assignedMembers.reduce((sum, member) => sum + member.skill_level, 0) / assignedMembers.length;
      if (avgSkill < SKILL_THRESHOLD) {
        issues.push({
          type: 'imbalance',
          severity: avgSkill < 2 ? 'high' : 'medium',
          message: `${DAY_LABELS[day]} ${template.name}: average skill is ${toOneDecimal(avgSkill)}.`,
          context: { day, template_id: templateId }
        });
      }
    }
  }

  for (const member of staff) {
    const hours = scheduledHoursByStaff[member.id] ?? 0;
    if (member.skill_level >= 4 && hours < 15) {
      issues.push({
        type: 'underutilized',
        severity: 'low',
        message: `${member.name} is underutilized (${toOneDecimal(hours)}h, skill ${member.skill_level}).`,
        context: { staff_id: member.id }
      });
    }
  }

  for (const [shiftRoleKey, shiftAssignments] of groupedByShiftRole.entries()) {
    const [dayRaw, templateId, role] = shiftRoleKey.split(':');
    if (!CRITICAL_ROLES.has(role)) {
      continue;
    }

    const day = Number(dayRaw);
    const template = templateById[templateId];
    if (!template) {
      continue;
    }

    const assignedForRole = shiftAssignments.filter((assignment) => Boolean(assignment.staff_id));
    const assignedCount = assignedForRole.length;

    if (assignedCount === 0) {
      issues.push({
        type: 'coverage',
        severity: 'high',
        message: `${DAY_LABELS[day]} ${template.name}: no ${role} assigned.`,
        context: { day, template_id: templateId }
      });
      continue;
    }

    if (assignedCount === 1) {
      const qualifiedCount = staff.filter((member) =>
        member.roles.map((entry) => entry.toLowerCase()).includes(role)
      ).length;

      issues.push({
        type: 'coverage',
        severity: qualifiedCount <= 1 ? 'high' : 'medium',
        message: `${DAY_LABELS[day]} ${template.name}: only one ${role} assigned.`,
        context: { day, template_id: templateId, staff_id: assignedForRole[0].staff_id ?? undefined }
      });
    }
  }

  const perTypeLimit: Record<ScheduleIssue['type'], number> = {
    fatigue: 3,
    imbalance: 4,
    underutilized: 3,
    coverage: 4
  };
  const perTypeCount: Record<ScheduleIssue['type'], number> = {
    fatigue: 0,
    imbalance: 0,
    underutilized: 0,
    coverage: 0
  };
  const selected: ScheduleIssue[] = [];

  for (const issue of issues.sort((a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity))) {
    if (selected.length >= 10) {
      break;
    }
    if (perTypeCount[issue.type] >= perTypeLimit[issue.type]) {
      continue;
    }

    selected.push(issue);
    perTypeCount[issue.type] += 1;
  }

  return selected;
}
