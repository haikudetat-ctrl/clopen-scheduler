'use client';

import type { Staff } from '../../../types/schedule';
import StaffDropdown from './StaffDropdown';

type PositionBlock = {
  assignmentId: string;
  role: string;
  staffId: string | null;
  slotNumber: number;
};

type ShiftCellProps = {
  day: number;
  shiftStart: string;
  shiftEnd: string;
  positions: PositionBlock[];
  staffById: Record<string, Staff>;
  scheduledHoursByStaff: Record<string, number>;
  onAssign: (assignmentId: string, staffId: string | null) => void;
  highlightSeverity: 'low' | 'medium' | 'high' | null;
};

const ROLE_COLORS: Record<string, string> = {
  server: 'border-blue-300 bg-blue-50',
  bartender: 'border-orange-300 bg-orange-50',
  host: 'border-green-300 bg-green-50',
  cook: 'border-red-300 bg-red-50'
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role.toLowerCase()] ?? 'border-gray-300 bg-gray-50';
}

function getCellHighlightColor(severity: ShiftCellProps['highlightSeverity']): string {
  if (severity === 'high') {
    return 'bg-red-50 shadow-[inset_0_0_0_2px_rgba(220,38,38,0.35)]';
  }
  if (severity === 'medium') {
    return 'bg-amber-50 shadow-[inset_0_0_0_2px_rgba(217,119,6,0.3)]';
  }
  if (severity === 'low') {
    return 'bg-blue-50 shadow-[inset_0_0_0_2px_rgba(37,99,235,0.25)]';
  }
  return '';
}

export default function ShiftCell({
  day,
  shiftStart,
  shiftEnd,
  positions,
  staffById,
  scheduledHoursByStaff,
  onAssign,
  highlightSeverity
}: ShiftCellProps) {
  return (
    <td className={`border border-gray-200 p-2 align-top ${getCellHighlightColor(highlightSeverity)}`}>
      <div className="space-y-2">
        {positions.length === 0 ? <div className="text-xs text-gray-500">No positions</div> : null}
        {positions.map((position) => (
          <div
            key={position.assignmentId}
            className={`rounded border p-2 ${getRoleColor(position.role)}`}
          >
            <div className="mb-1 text-xs font-semibold text-gray-800">
              {position.role} #{position.slotNumber}
            </div>
            <StaffDropdown
              day={day}
              role={position.role}
              shiftStart={shiftStart}
              shiftEnd={shiftEnd}
              selectedStaffId={position.staffId}
              selectedStaffName={position.staffId ? staffById[position.staffId]?.name ?? null : null}
              scheduledHoursByStaff={scheduledHoursByStaff}
              onAssign={(staffId) => onAssign(position.assignmentId, staffId)}
            />
          </div>
        ))}
      </div>
    </td>
  );
}
