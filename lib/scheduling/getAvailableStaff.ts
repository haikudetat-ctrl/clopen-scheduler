import { supabase } from '../supabaseClient';
import type { Staff } from '../../types/schedule';

export async function getAvailableStaff(
  dayOfWeek: number,
  shiftStart: string,
  shiftEnd: string,
  role: string
): Promise<Staff[]> {
  const { data: roleQualifiedStaff, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('active', true)
    .contains('roles', [role]);

  if (staffError) {
    throw staffError;
  }

  if (!roleQualifiedStaff || roleQualifiedStaff.length === 0) {
    return [];
  }

  const candidateIds = roleQualifiedStaff.map((member) => member.id);

  const { data: availabilityRows, error: availabilityError } = await supabase
    .from('availability')
    .select('staff_id')
    .eq('day_of_week', dayOfWeek)
    .lte('start_time', shiftStart)
    .gte('end_time', shiftEnd)
    .in('staff_id', candidateIds);

  if (availabilityError) {
    throw availabilityError;
  }

  const availableStaffIds = new Set((availabilityRows ?? []).map((row) => row.staff_id));

  return (roleQualifiedStaff as Staff[]).filter((member) => availableStaffIds.has(member.id));
}
