import ScheduleWorkspace from './components/ScheduleWorkspace';
import { supabase } from '../../lib/supabaseClient';
import type {
  Availability,
  ScheduleAssignment,
  ShiftRequirement,
  ShiftTemplate,
  Staff
} from '../../types/schedule';

type InitialData = {
  staff: Staff[];
  shiftTemplates: ShiftTemplate[];
  shiftRequirements: ShiftRequirement[];
  assignments: ScheduleAssignment[];
  error: string | null;
};

function isPlaceholderSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.includes('example.supabase.co') || key.includes('replace-with-your-anon-key');
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'PGRST205'
  ) {
    return 'Required scheduling tables are missing. Run supabase/schema.sql in your Supabase SQL editor, then refresh.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return 'Unknown error loading schedule';
}

function getCurrentWeekStartIsoDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

async function ensureSeedData(): Promise<string> {
  if (isPlaceholderSupabaseConfig()) {
    throw new Error(
      'Supabase is not configured. Update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
  }

  const weekStart = getCurrentWeekStartIsoDate();

  const { count: staffCount, error: staffCountError } = await supabase
    .from('staff')
    .select('id', { count: 'exact', head: true });
  if (staffCountError) {
    throw staffCountError;
  }

  if ((staffCount ?? 0) === 0) {
    const { error: seedStaffError } = await supabase.from('staff').insert([
      { name: 'Ava', roles: ['server'], skill_level: 4, active: true },
      { name: 'Noah', roles: ['server', 'bartender'], skill_level: 5, active: true },
      { name: 'Mia', roles: ['bartender'], skill_level: 4, active: true },
      { name: 'Liam', roles: ['server'], skill_level: 3, active: true },
      { name: 'Emma', roles: ['host', 'server'], skill_level: 4, active: true }
    ]);
    if (seedStaffError) {
      throw seedStaffError;
    }
  }

  const { data: seededStaff, error: seededStaffError } = await supabase
    .from('staff')
    .select('*')
    .eq('active', true);
  if (seededStaffError) {
    throw seededStaffError;
  }

  const { count: availabilityCount, error: availabilityCountError } = await supabase
    .from('availability')
    .select('id', { count: 'exact', head: true });
  if (availabilityCountError) {
    throw availabilityCountError;
  }

  if ((availabilityCount ?? 0) === 0) {
    const availabilityRows: Omit<Availability, 'id'>[] = [];

    for (const member of (seededStaff ?? []) as Staff[]) {
      for (let day = 0; day <= 6; day += 1) {
        availabilityRows.push({
          staff_id: member.id,
          day_of_week: day,
          start_time: '10:00',
          end_time: '23:00'
        });
      }
    }

    const { error: seedAvailabilityError } = await supabase.from('availability').insert(availabilityRows);
    if (seedAvailabilityError) {
      throw seedAvailabilityError;
    }
  }

  const { count: templateCount, error: templateCountError } = await supabase
    .from('shift_templates')
    .select('id', { count: 'exact', head: true });
  if (templateCountError) {
    throw templateCountError;
  }

  if ((templateCount ?? 0) === 0) {
    const { error: seedTemplatesError } = await supabase.from('shift_templates').insert([
      { name: 'Lunch', start_time: '11:00', end_time: '16:00' },
      { name: 'Dinner', start_time: '17:00', end_time: '22:00' }
    ]);
    if (seedTemplatesError) {
      throw seedTemplatesError;
    }
  }

  const { data: templates, error: templatesError } = await supabase.from('shift_templates').select('*');
  if (templatesError) {
    throw templatesError;
  }

  const templateByName = (templates ?? []).reduce<Record<string, ShiftTemplate>>((acc, template) => {
    acc[template.name] = template as ShiftTemplate;
    return acc;
  }, {});

  const { count: requirementsCount, error: requirementsCountError } = await supabase
    .from('shift_requirements')
    .select('id', { count: 'exact', head: true });
  if (requirementsCountError) {
    throw requirementsCountError;
  }

  if ((requirementsCount ?? 0) === 0) {
    const lunch = templateByName.Lunch;
    const dinner = templateByName.Dinner;
    if (!lunch || !dinner) {
      throw new Error('Seed templates Lunch and Dinner are required.');
    }

    const requirementRows: Omit<ShiftRequirement, 'id'>[] = [
      { template_id: lunch.id, role: 'server', required_count: 2 },
      { template_id: lunch.id, role: 'bartender', required_count: 1 },
      { template_id: dinner.id, role: 'server', required_count: 2 },
      { template_id: dinner.id, role: 'bartender', required_count: 1 }
    ];

    const { error: seedRequirementsError } = await supabase.from('shift_requirements').insert(requirementRows);
    if (seedRequirementsError) {
      throw seedRequirementsError;
    }
  }

  const { data: ensuredSchedule, error: ensuredScheduleError } = await supabase
    .from('schedules')
    .upsert({ week_start: weekStart }, { onConflict: 'week_start' })
    .select('*')
    .single();
  if (ensuredScheduleError || !ensuredSchedule?.id) {
    throw ensuredScheduleError ?? new Error('Unable to create or load schedule');
  }
  const scheduleId = ensuredSchedule.id as string;

  const { count: assignmentCount, error: assignmentCountError } = await supabase
    .from('schedule_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', scheduleId);
  if (assignmentCountError) {
    throw assignmentCountError;
  }

  if ((assignmentCount ?? 0) === 0) {
    const { data: requirements, error: requirementsError } = await supabase
      .from('shift_requirements')
      .select('*');
    if (requirementsError) {
      throw requirementsError;
    }

    const assignments: Omit<ScheduleAssignment, 'id'>[] = [];
    for (let day = 0; day <= 6; day += 1) {
      for (const requirement of (requirements ?? []) as ShiftRequirement[]) {
        for (let i = 0; i < requirement.required_count; i += 1) {
          assignments.push({
            schedule_id: scheduleId,
            day,
            template_id: requirement.template_id,
            role: requirement.role,
            staff_id: null
          });
        }
      }
    }

    const { error: seedAssignmentsError } = await supabase.from('schedule_assignments').insert(assignments);
    if (seedAssignmentsError) {
      throw seedAssignmentsError;
    }
  }

  return scheduleId;
}

async function getInitialData(): Promise<InitialData> {
  try {
    const scheduleId = await ensureSeedData();

    const [staffResult, templatesResult, requirementsResult, assignmentsResult] = await Promise.all([
      supabase.from('staff').select('*').eq('active', true).order('name', { ascending: true }),
      supabase.from('shift_templates').select('*').order('start_time', { ascending: true }),
      supabase
        .from('shift_requirements')
        .select('*')
        .order('template_id', { ascending: true })
        .order('role', { ascending: true }),
      supabase
        .from('schedule_assignments')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('day', { ascending: true })
        .order('template_id', { ascending: true })
        .order('role', { ascending: true })
        .order('id', { ascending: true })
    ]);

    if (staffResult.error) {
      return {
        staff: [],
        shiftTemplates: [],
        shiftRequirements: [],
        assignments: [],
        error: staffResult.error.message
      };
    }
    if (templatesResult.error) {
      return {
        staff: [],
        shiftTemplates: [],
        shiftRequirements: [],
        assignments: [],
        error: templatesResult.error.message
      };
    }
    if (requirementsResult.error) {
      return {
        staff: [],
        shiftTemplates: [],
        shiftRequirements: [],
        assignments: [],
        error: requirementsResult.error.message
      };
    }
    if (assignmentsResult.error) {
      return {
        staff: [],
        shiftTemplates: [],
        shiftRequirements: [],
        assignments: [],
        error: assignmentsResult.error.message
      };
    }

    return {
      staff: (staffResult.data ?? []) as Staff[],
      shiftTemplates: (templatesResult.data ?? []) as ShiftTemplate[],
      shiftRequirements: (requirementsResult.data ?? []) as ShiftRequirement[],
      assignments: (assignmentsResult.data ?? []) as ScheduleAssignment[],
      error: null
    };
  } catch (error) {
    return {
      staff: [],
      shiftTemplates: [],
      shiftRequirements: [],
      assignments: [],
      error: getErrorMessage(error)
    };
  }
}

export default async function SchedulePage() {
  const { staff, shiftTemplates, shiftRequirements, assignments, error } = await getInitialData();

  return (
    <main className="mx-auto w-full max-w-7xl p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Weekly Scheduler</h1>
        <p className="mt-1 text-sm text-gray-600">
          Click any position block to assign available, role-qualified staff.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load schedule: {error}
        </div>
      ) : null}

      {!error ? (
        <ScheduleWorkspace
          staff={staff}
          shiftTemplates={shiftTemplates}
          shiftRequirements={shiftRequirements}
          initialAssignments={assignments}
          analyzeButtonLabel="Analyze Schedule"
        />
      ) : null}
    </main>
  );
}
