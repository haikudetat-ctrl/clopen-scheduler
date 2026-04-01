export type Staff = {
  id: string;
  name: string;
  roles: string[];
  skill_level: number;
  active: boolean;
};

export type Availability = {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type ShiftTemplate = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
};

export type ShiftRequirement = {
  id: string;
  template_id: string;
  role: string;
  required_count: number;
};

export type ScheduleAssignment = {
  id: string;
  schedule_id: string;
  day: number;
  template_id: string;
  role: string;
  staff_id: string | null;
};

export type Schedule = {
  id: string;
  week_start: string;
  assignments?: ScheduleAssignment[];
};
