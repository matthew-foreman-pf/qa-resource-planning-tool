import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import {
  fromDateStr,
  formatDateFull,
  getWeekStart,
  toDateStr,
  getPlanningWeeks,
  getWeekdaysInRangeStr,
} from '../../utils/dates';
import { getWorkItemLabel } from '../../utils/helpers';
import type { RiskLevel } from '../../types';

export function DayAssignmentDrawer() {
  const selectedCellInfo = useStore((s) => s.selectedCellInfo);
  const dayDrawerOpen = useStore((s) => s.dayDrawerOpen);
  const closeDayDrawer = useStore((s) => s.closeDayDrawer);
  const people = useStore((s) => s.people);
  const workItems = useStore((s) => s.workItems);
  const allocations = useStore((s) => s.allocations);
  const timeOffs = useStore((s) => s.timeOffs);
  const removeAllocation = useStore((s) => s.removeAllocation);
  const setAllocationForDay = useStore((s) => s.setAllocationForDay);
  const setAllocationForRange = useStore((s) => s.setAllocationForRange);
  const addTimeOff = useStore((s) => s.addTimeOff);
  const removeTimeOff = useStore((s) => s.removeTimeOff);

  const weeks = useMemo(() => getPlanningWeeks(12), []);

  if (!dayDrawerOpen || !selectedCellInfo) return null;

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
  const cap = person.weeklyCapacityDays;

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
  if (weeklyLoad >= 6) capacityRisk = 'red';
  else if (weeklyLoad > 5) capacityRisk = 'yellow';

  const wiMap = Object.fromEntries(workItems.map((wi) => [wi.id, wi]));

  return (
    <div className="day-drawer-overlay" onClick={closeDayDrawer}>
      <div className="day-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3 className="day-drawer-title">{person.name}</h3>
            <span className="day-drawer-date">{formatDateFull(dateObj)}</span>
          </div>
          <button className="btn btn--sm" onClick={closeDayDrawer}>
            &times;
          </button>
        </div>
        <div className="drawer-body">
          {/* Current assignments */}
          <div className="day-drawer-section">
            <h4>Current Assignments</h4>
            {isOff ? (
              <div className="time-off-toggle-row">
                <div className="side-panel-badge badge--red">
                  Time Off{timeOffEntry?.reason ? `: ${timeOffEntry.reason}` : ''}
                </div>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    if (timeOffEntry) removeTimeOff(timeOffEntry.id);
                  }}
                >
                  Remove Time Off
                </button>
              </div>
            ) : dayAllocs.length === 0 ? (
              <div className="side-panel-badge badge--neutral">Available</div>
            ) : (
              <ul className="day-drawer-alloc-list">
                {dayAllocs.map((a) => {
                  const wi = wiMap[a.workItemId];
                  return (
                    <li key={a.id} className="day-drawer-alloc-item">
                      <span className="day-drawer-alloc-name">
                        {wi ? getWorkItemLabel(wi) : 'Unknown'}
                      </span>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => removeAllocation(a.id)}
                        title="Remove this assignment"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Time off toggle */}
          {!isOff && (
            <TimeOffToggleSection
              personId={personId}
              date={date}
              dayAllocs={dayAllocs}
              addTimeOff={addTimeOff}
              removeAllocation={removeAllocation}
            />
          )}

          {/* Warnings */}
          {(capacityRisk !== 'green' || contextRisk !== 'green') && (
            <div className="day-drawer-warnings">
              {capacityRisk !== 'green' && (
                <div className={`day-drawer-warning day-drawer-warning--${capacityRisk}`}>
                  <WarningIcon />
                  <span>
                    {capacityRisk === 'red' ? 'Capacity OVERLOADED' : 'Capacity warning'}:
                    {' '}{weeklyLoad.toFixed(1)} / {cap.toFixed(1)}d this week
                  </span>
                </div>
              )}
              {contextRisk !== 'green' && (
                <div className={`day-drawer-warning day-drawer-warning--${contextRisk}`}>
                  <WarningIcon />
                  <span>
                    {contextRisk === 'red' ? 'Context switching OVERLOADED' : 'Context switching warning'}:
                    {' '}{distinctItems} distinct items this week
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Weekly load bar */}
          <div className="day-drawer-section">
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
                {weeklyLoad.toFixed(1)} / {cap.toFixed(1)}d
              </span>
            </div>
          </div>

          {/* Weekly assignments summary */}
          <div className="day-drawer-section">
            <h4>Weekly Assignments</h4>
            {Array.from(new Set(weekAllocs.map((a) => a.workItemId))).length === 0 ? (
              <span className="day-drawer-muted">No assignments this week</span>
            ) : (
              <ul className="day-drawer-week-summary">
                {Array.from(new Set(weekAllocs.map((a) => a.workItemId))).map(
                  (wiId) => {
                    const wi = wiMap[wiId];
                    const days = weekAllocs
                      .filter((a) => a.workItemId === wiId)
                      .reduce((s, a) => s + a.days, 0);
                    return (
                      <li key={wiId}>
                        {wi ? getWorkItemLabel(wi) : 'Unknown'}: {days.toFixed(1)}d
                      </li>
                    );
                  }
                )}
              </ul>
            )}
          </div>

          <hr className="drawer-divider" />

          {/* Assign work item section */}
          <h4 className="drawer-section-title">Assign Work Item</h4>
          <AssignForDaySection
            personId={personId}
            date={date}
            workItems={workItems}
            existingAllocWorkItemIds={new Set(dayAllocs.map((a) => a.workItemId))}
            setAllocationForDay={setAllocationForDay}
          />

          <AssignForRangeSection
            personId={personId}
            date={date}
            workItems={workItems}
            setAllocationForRange={setAllocationForRange}
          />
        </div>
      </div>
    </div>
  );
}

/* ---- Warning Icon ---- */

function WarningIcon() {
  return (
    <svg className="warning-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 1L13 12H1L7 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 5.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.5" fill="currentColor" />
    </svg>
  );
}

/* ---- Time Off Toggle ---- */

function TimeOffToggleSection({
  personId,
  date,
  dayAllocs,
  addTimeOff,
  removeAllocation,
}: {
  personId: string;
  date: string;
  dayAllocs: { id: string }[];
  addTimeOff: (to: { id: string; personId: string; date: string; reason?: string }) => Promise<void>;
  removeAllocation: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const handleConfirm = async () => {
    // Remove any existing allocations for this day
    for (const a of dayAllocs) {
      await removeAllocation(a.id);
    }
    // Add time off
    await addTimeOff({
      id: crypto.randomUUID(),
      personId,
      date,
      reason: reason.trim() || undefined,
    });
    setShowForm(false);
    setReason('');
    setMsg('Marked as time off');
    setTimeout(() => setMsg(''), 2000);
  };

  if (!showForm) {
    return (
      <div className="day-drawer-section">
        <div className="time-off-toggle-row">
          <button
            className="btn btn--sm btn--timeoff"
            onClick={() => setShowForm(true)}
          >
            Mark Time Off
          </button>
          {msg && <span className="drawer-saved-msg">{msg}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="day-drawer-section">
      <div className="time-off-form">
        <div className="form-group">
          <label>Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. PTO, Conference, Sick day"
            className="time-off-reason-input"
          />
        </div>
        <div className="form-actions">
          <button className="btn btn--primary btn--sm" onClick={handleConfirm}>
            Confirm
          </button>
          <button className="btn btn--sm" onClick={() => { setShowForm(false); setReason(''); }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Assign For Day ---- */

function AssignForDaySection({
  personId,
  date,
  workItems,
  existingAllocWorkItemIds,
  setAllocationForDay,
}: {
  personId: string;
  date: string;
  workItems: ReturnType<typeof useStore.getState>['workItems'];
  existingAllocWorkItemIds: Set<string>;
  setAllocationForDay: (personId: string, date: string, workItemId: string) => Promise<void>;
}) {
  const [wiId, setWiId] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const filteredWIs = useMemo(() => {
    let items = workItems;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (wi) =>
          wi.name.toLowerCase().includes(q) ||
          getWorkItemLabel(wi).toLowerCase().includes(q)
      );
    }
    return items;
  }, [workItems, search]);

  const handleAssign = async () => {
    if (!wiId) return;
    await setAllocationForDay(personId, date, wiId);
    setMsg('Assigned!');
    setWiId('');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="drawer-action-block">
      <h5>Assign for This Day</h5>
      <div className="form-group">
        <label>Work Item</label>
        <input
          type="text"
          placeholder="Search work items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="drawer-search-input"
        />
        <select
          value={wiId}
          onChange={(e) => setWiId(e.target.value)}
          size={Math.min(5, filteredWIs.length + 1)}
          className="drawer-wi-select"
        >
          <option value="">-- Select --</option>
          {filteredWIs.map((wi) => (
            <option
              key={wi.id}
              value={wi.id}
              className={existingAllocWorkItemIds.has(wi.id) ? 'option--already-assigned' : ''}
            >
              {getWorkItemLabel(wi)}
              {existingAllocWorkItemIds.has(wi.id) ? ' (already assigned)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleAssign}
          disabled={!wiId}
        >
          Assign
        </button>
        {msg && <span className="drawer-saved-msg">{msg}</span>}
      </div>
    </div>
  );
}

/* ---- Assign For Range ---- */

function AssignForRangeSection({
  personId,
  date,
  workItems,
  setAllocationForRange,
}: {
  personId: string;
  date: string;
  workItems: ReturnType<typeof useStore.getState>['workItems'];
  setAllocationForRange: (personId: string, workItemId: string, startDate: string, endDate: string, weekdaysOnly: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [wiId, setWiId] = useState('');
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(date);
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const filteredWIs = useMemo(() => {
    if (!search) return workItems;
    const q = search.toLowerCase();
    return workItems.filter(
      (wi) =>
        wi.name.toLowerCase().includes(q) ||
        getWorkItemLabel(wi).toLowerCase().includes(q)
    );
  }, [workItems, search]);

  // Calculate how many days will be assigned
  const dayCount = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return 0;
    if (weekdaysOnly) {
      return getWeekdaysInRangeStr(startDate, endDate).length;
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    let count = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      count++;
    }
    return count;
  }, [startDate, endDate, weekdaysOnly]);

  const handleApply = async () => {
    if (!wiId || !startDate || !endDate) return;
    await setAllocationForRange(personId, wiId, startDate, endDate, weekdaysOnly);
    setMsg(`Assigned ${dayCount} day(s)`);
    setTimeout(() => setMsg(''), 2500);
  };

  if (!expanded) {
    return (
      <div className="drawer-action-block">
        <button
          className="btn btn--sm day-drawer-expand-btn"
          onClick={() => setExpanded(true)}
        >
          Assign for range&hellip;
        </button>
      </div>
    );
  }

  return (
    <div className="drawer-action-block">
      <h5>Assign for Range</h5>
      <div className="form-group">
        <label>Work Item</label>
        <input
          type="text"
          placeholder="Search work items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="drawer-search-input"
        />
        <select
          value={wiId}
          onChange={(e) => setWiId(e.target.value)}
          size={Math.min(5, filteredWIs.length + 1)}
          className="drawer-wi-select"
        >
          <option value="">-- Select --</option>
          {filteredWIs.map((wi) => (
            <option key={wi.id} value={wi.id}>
              {getWorkItemLabel(wi)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>End</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <label className="toolbar-checkbox" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={weekdaysOnly}
          onChange={(e) => setWeekdaysOnly(e.target.checked)}
        />
        Weekdays only
      </label>
      {dayCount > 0 && (
        <div className="day-drawer-range-preview">
          Will assign <strong>{dayCount}</strong> day{dayCount !== 1 ? 's' : ''}
        </div>
      )}
      <div className="form-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleApply}
          disabled={!wiId || !startDate || !endDate || dayCount === 0}
        >
          Apply Range
        </button>
        <button
          className="btn btn--sm"
          onClick={() => setExpanded(false)}
        >
          Cancel
        </button>
        {msg && <span className="drawer-saved-msg">{msg}</span>}
      </div>
    </div>
  );
}
