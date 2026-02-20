import { useMemo } from 'react';
import { useStore } from '../../store';
import {
  fromDateStr,
  formatDateFull,
  getWeekStart,
  toDateStr,
  getPlanningWeeks,
} from '../../utils/dates';
import { getWorkItemLabel } from '../../utils/helpers';
import {
  computeContextSwitchingRisks,
  computeCapacityRisks,
} from '../../utils/risks';
import type { RiskLevel } from '../../types';

export function SidePanel() {
  const selectedCellInfo = useStore((s) => s.selectedCellInfo);
  const sidePanelOpen = useStore((s) => s.sidePanelOpen);
  const closeSidePanel = useStore((s) => s.closeSidePanel);
  const people = useStore((s) => s.people);
  const workItems = useStore((s) => s.workItems);
  const allocations = useStore((s) => s.allocations);
  const timeOffs = useStore((s) => s.timeOffs);

  const weeks = useMemo(() => getPlanningWeeks(12), []);

  if (!sidePanelOpen || !selectedCellInfo) return null;

  const { personId, date } = selectedCellInfo;
  const person = people.find((p) => p.id === personId);
  if (!person) return null;

  const dateObj = fromDateStr(date);
  const weekStart = getWeekStart(dateObj);
  const weekStartStr = toDateStr(weekStart);

  // Find the week
  const week = weeks.find((w) => w.weekStartStr === weekStartStr);
  const weekDays = week ? week.weekdays.map(toDateStr) : [];

  // Allocations for this person this day
  const dayAllocs = allocations.filter(
    (a) => a.personId === personId && a.date === date
  );

  // Weekly load
  const weekAllocs = allocations.filter(
    (a) => a.personId === personId && weekDays.includes(a.date)
  );
  const weeklyLoad = weekAllocs.reduce((sum, a) => sum + a.days, 0);
  const cap = person.weeklyCapacityDays * (1 - person.weeklyBufferPct);

  // Context switching
  const distinctItems = new Set(weekAllocs.map((a) => a.workItemId)).size;

  // Time off this day
  const isOff = timeOffs.some(
    (to) => to.personId === personId && to.date === date
  );
  const timeOffEntry = timeOffs.find(
    (to) => to.personId === personId && to.date === date
  );

  // Risk indicators
  let contextRisk: RiskLevel = 'green';
  if (distinctItems >= 6) contextRisk = 'red';
  else if (distinctItems >= 4) contextRisk = 'yellow';

  let capacityRisk: RiskLevel = 'green';
  if (weeklyLoad >= 5.5) capacityRisk = 'red';
  else if (weeklyLoad > 4.5) capacityRisk = 'yellow';

  const wiMap = Object.fromEntries(workItems.map((wi) => [wi.id, wi]));

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h3>{person.name}</h3>
        <button className="btn btn--sm" onClick={closeSidePanel}>
          &times;
        </button>
      </div>
      <div className="side-panel-content">
        <div className="side-panel-section">
          <h4>{formatDateFull(dateObj)}</h4>
          {isOff ? (
            <div className="side-panel-badge badge--red">
              Time Off{timeOffEntry?.reason ? `: ${timeOffEntry.reason}` : ''}
            </div>
          ) : dayAllocs.length === 0 ? (
            <div className="side-panel-badge badge--neutral">Available</div>
          ) : (
            <ul className="side-panel-allocs">
              {dayAllocs.map((a) => {
                const wi = wiMap[a.workItemId];
                return (
                  <li key={a.id}>
                    {wi ? getWorkItemLabel(wi) : 'Unknown'} ({a.days}d)
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="side-panel-section">
          <h4>Weekly Load ({week?.weekLabel})</h4>
          <div className="side-panel-load">
            <div className="load-bar-container">
              <div
                className={`load-bar ${
                  capacityRisk === 'red'
                    ? 'load-bar--red'
                    : capacityRisk === 'yellow'
                      ? 'load-bar--yellow'
                      : 'load-bar--green'
                }`}
                style={{ width: `${Math.min(100, (weeklyLoad / 5) * 100)}%` }}
              />
            </div>
            <span>
              {weeklyLoad} / {cap} days (cap)
            </span>
          </div>
          {capacityRisk !== 'green' && (
            <div className={`side-panel-badge badge--${capacityRisk}`}>
              Capacity {capacityRisk === 'red' ? 'OVERLOADED' : 'Warning'}
            </div>
          )}
        </div>

        <div className="side-panel-section">
          <h4>Context Switching</h4>
          <p>
            {distinctItems} distinct work item{distinctItems !== 1 ? 's' : ''}{' '}
            this week
          </p>
          {contextRisk !== 'green' && (
            <div className={`side-panel-badge badge--${contextRisk}`}>
              Context Switching{' '}
              {contextRisk === 'red' ? 'OVERLOADED' : 'Warning'}
            </div>
          )}
        </div>

        <div className="side-panel-section">
          <h4>Weekly Assignments</h4>
          <ul className="side-panel-allocs">
            {Array.from(new Set(weekAllocs.map((a) => a.workItemId))).map(
              (wiId) => {
                const wi = wiMap[wiId];
                const days = weekAllocs
                  .filter((a) => a.workItemId === wiId)
                  .reduce((s, a) => s + a.days, 0);
                return (
                  <li key={wiId}>
                    {wi ? getWorkItemLabel(wi) : 'Unknown'}: {days}d
                  </li>
                );
              }
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
