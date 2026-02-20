import { useMemo } from 'react';
import { useStore } from '../../store';
import { getPlanningWeeks, toDateStr, formatDayHeader } from '../../utils/dates';
import { getWorkItemLabel } from '../../utils/helpers';
import type { Allocation, WorkItem, TimeOff, Person } from '../../types';

export function RosterGrid() {
  const people = useStore((s) => s.people);
  const workItems = useStore((s) => s.workItems);
  const allocations = useStore((s) => s.allocations);
  const timeOffs = useStore((s) => s.timeOffs);
  const selectCell = useStore((s) => s.selectCell);

  const weeks = useMemo(() => getPlanningWeeks(12), []);

  // Build lookup maps
  const allocByPersonDate = useMemo(() => {
    const map: Record<string, Allocation[]> = {};
    for (const a of allocations) {
      const key = `${a.personId}|${a.date}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [allocations]);

  const wiMap = useMemo(() => {
    const map: Record<string, WorkItem> = {};
    for (const wi of workItems) map[wi.id] = wi;
    return map;
  }, [workItems]);

  const timeOffSet = useMemo(() => {
    const set = new Set<string>();
    for (const to of timeOffs) {
      set.add(`${to.personId}|${to.date}`);
    }
    return set;
  }, [timeOffs]);

  // Sort people: leads first (qa_lead, pod_lead), then vendors
  const sortedPeople = useMemo(() => {
    const roleOrder = { qa_lead: 0, pod_lead: 1, tester: 2 };
    return [...people].sort((a, b) => {
      const ro = roleOrder[a.role] - roleOrder[b.role];
      if (ro !== 0) return ro;
      return a.name.localeCompare(b.name);
    });
  }, [people]);

  const totalDays = weeks.reduce((sum, w) => sum + w.weekdays.length, 0);

  return (
    <div className="roster-container">
      <div className="roster-grid" style={{ gridTemplateColumns: `180px repeat(${totalDays}, 1fr)` }}>
        {/* Header row: week headers */}
        <div className="roster-header-cell roster-name-header">Person</div>
        {weeks.map((week) =>
          week.weekdays.map((day, di) => (
            <div
              key={toDateStr(day)}
              className={`roster-header-cell ${di === 0 ? 'roster-week-start' : ''}`}
              title={week.weekLabel}
            >
              <span className="roster-day-label">{formatDayHeader(day)}</span>
              {di === 0 && (
                <span className="roster-week-label">{week.weekLabel}</span>
              )}
            </div>
          ))
        )}

        {/* People rows */}
        {sortedPeople.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            weeks={weeks}
            allocByPersonDate={allocByPersonDate}
            wiMap={wiMap}
            timeOffSet={timeOffSet}
            onCellClick={selectCell}
          />
        ))}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  weeks,
  allocByPersonDate,
  wiMap,
  timeOffSet,
  onCellClick,
}: {
  person: Person;
  weeks: ReturnType<typeof getPlanningWeeks>;
  allocByPersonDate: Record<string, Allocation[]>;
  wiMap: Record<string, WorkItem>;
  timeOffSet: Set<string>;
  onCellClick: (personId: string, date: string) => void;
}) {
  return (
    <>
      <div className={`roster-name-cell ${person.type === 'vendor' ? 'roster-name-cell--vendor' : ''}`}>
        <span className="person-name">{person.name}</span>
        <span className="person-role">
          {person.role === 'qa_lead'
            ? 'QA Lead'
            : person.role === 'pod_lead'
              ? 'Pod Lead'
              : 'Vendor'}
        </span>
      </div>
      {weeks.map((week) =>
        week.weekdays.map((day, di) => {
          const dateStr = toDateStr(day);
          const key = `${person.id}|${dateStr}`;
          const allocs = allocByPersonDate[key] || [];
          const isOff = timeOffSet.has(key);

          let cellClass = 'roster-cell';
          if (di === 0) cellClass += ' roster-week-start';
          if (isOff) {
            cellClass += ' roster-cell--timeoff';
          } else if (allocs.length > 0) {
            cellClass += person.type === 'vendor'
              ? ' roster-cell--assigned-vendor'
              : ' roster-cell--assigned';
          } else {
            cellClass += ' roster-cell--available';
          }

          const wiNames = allocs
            .map((a) => {
              const wi = wiMap[a.workItemId];
              return wi ? getWorkItemLabel(wi) : '?';
            });

          return (
            <div
              key={dateStr}
              className={cellClass}
              onClick={() => onCellClick(person.id, dateStr)}
              title={isOff ? 'Time Off' : wiNames.join(', ') || 'Available'}
            >
              {isOff ? (
                <span className="cell-label cell-label--off">OFF</span>
              ) : wiNames.length > 0 ? (
                <span className="cell-label">
                  {wiNames.length === 1
                    ? wiNames[0]
                    : `${wiNames.length} items`}
                </span>
              ) : null}
            </div>
          );
        })
      )}
    </>
  );
}
