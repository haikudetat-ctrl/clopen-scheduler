'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAvailableStaff } from '../../../lib/scheduling/getAvailableStaff';
import type { Staff } from '../../../types/schedule';

type StaffDropdownProps = {
  day: number;
  role: string;
  shiftStart: string;
  shiftEnd: string;
  selectedStaffId: string | null;
  selectedStaffName?: string | null;
  onAssign: (staffId: string | null) => void;
  scheduledHoursByStaff: Record<string, number>;
};

export default function StaffDropdown({
  day,
  role,
  shiftStart,
  shiftEnd,
  selectedStaffId,
  selectedStaffName = null,
  onAssign,
  scheduledHoursByStaff
}: StaffDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Staff[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getAvailableStaff(day, shiftStart, shiftEnd, role)
      .then((staff) => {
        if (active) {
          setOptions(staff);
        }
      })
      .catch((fetchError: { message?: string }) => {
        if (active) {
          setError(fetchError.message ?? 'Failed to load staff');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [day, isOpen, role, shiftEnd, shiftStart]);

  const selectedName = useMemo(
    () => (selectedStaffId ? selectedStaffName ?? 'Assigned' : 'Unassigned'),
    [selectedStaffId, selectedStaffName]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-left text-xs text-gray-800"
      >
        {selectedName}
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="mb-2 text-xs font-semibold text-gray-700">Assign staff</div>
          {isLoading ? <div className="text-xs text-gray-600">Loading...</div> : null}
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
          {!isLoading && !error ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onAssign(null);
                  setIsOpen(false);
                }}
                className="w-full rounded border border-gray-200 px-2 py-1 text-left text-xs hover:bg-gray-50"
              >
                Unassigned
              </button>
              {options.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    onAssign(member.id);
                    setIsOpen(false);
                  }}
                  className="w-full rounded border border-gray-200 px-2 py-1 text-left text-xs hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{member.name}</span>
                  <span className="ml-2 text-gray-600">Skill {member.skill_level}</span>
                  <span className="ml-2 text-gray-500">
                    {scheduledHoursByStaff[member.id] ?? 0}
                    h
                  </span>
                </button>
              ))}
              {options.length === 0 ? <div className="text-xs text-gray-600">No available staff</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
