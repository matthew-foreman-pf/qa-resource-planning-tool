import { useMemo, useState, useCallback } from 'react';
import { useStore } from '../../store';
import { getPlanningWeeks, toDateStr, fromDateStr, formatDate, today } from '../../utils/dates';
import type { WeekInfo } from '../../utils/dates';
import {
  getWorkItemLabel,
  getPodColor,
  getPersonWeekPodBreakdown,
} from '../../utils/helpers';
import { buildPodGroups } from '../../utils/grouping';
import type { WorkItem, Person, Allocation } from '../../types';
import { differenceInCalendarDays, format } from 'date-fns';

export function DashboardScreen() {
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const workItems = useStore((s) => s.workItems);
  const allocations = useStore((s) => s.allocations);
  const scenarios = useStore((s) => s.scenarios);
  const currentScenarioId = useStore((s) => s.currentScenarioId);
  const showArchivedPeople = useStore((s) => s.showArchivedPeople);
  const podFilterIds = useStore((s) => s.podFilterIds);
  const activeWeekStartDate = useStore((s) => s.activeWeekStartDate);

  const weeks = useMemo(() => getPlanningWeeks(12), []);

  const currentScenario = scenarios.find((s) => s.id === currentScenarioId);

  // Active week dates — same selector as RosterGrid
  const activeWeekDates = useMemo(() => {
    const week = weeks.find((w) => w.weekStartStr === activeWeekStartDate);
    if (!week) return new Set<string>();
    return new Set(week.weekdays.map(toDateStr));
  }, [weeks, activeWeekStartDate]);

  // Active week label for display
  const activeWeekLabel = useMemo(() => {
    const week = weeks.find((w) => w.weekStartStr === activeWeekStartDate);
    return week?.weekLabel || weeks[0]?.weekLabel || '';
  }, [weeks, activeWeekStartDate]);

  return (
    <div className="dashboard-screen">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="screen-subtitle">Overview of your QA plan at a glance</p>
      </div>
      <DashboardSummary
        scenario={currentScenario}
        people={people}
        allocations={allocations}
        weeks={weeks}
      />
      <DashboardGantt
        workItems={workItems}
        pods={pods}
        weeks={weeks}
      />
      <DashboardPeople
        people={people}
        pods={pods}
        allocations={allocations}
        workItems={workItems}
        activeWeekDates={activeWeekDates}
        activeWeekLabel={activeWeekLabel}
        showArchived={showArchivedPeople}
        podFilterIds={podFilterIds}
      />
    </div>
  );
}

/* ---- Summary Strip ---- */

function DashboardSummary({
  scenario,
  people,
  allocations,
  weeks,
}: {
  scenario: { id: string; name: string; isBase: boolean } | undefined;
  people: Person[];
  allocations: Allocation[];
  weeks: WeekInfo[];
}) {
  const activePeople = useMemo(
    () => people.filter((p) => p.status === 'active'),
    [people]
  );

  // Date range
  const firstWeekStart = weeks[0]?.weekStart;
  const lastWeek = weeks[weeks.length - 1];
  const lastWeekEnd = lastWeek?.weekdays[lastWeek.weekdays.length - 1];
  const dateRangeLabel = firstWeekStart && lastWeekEnd
    ? `${format(firstWeekStart, 'MMM d')} \u2013 ${format(lastWeekEnd, 'MMM d, yyyy')}`
    : '';

  // All dates in the 12-week range
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const w of weeks) {
      for (const d of w.weekdays) {
        dates.add(toDateStr(d));
      }
    }
    return dates;
  }, [weeks]);

  // Total capacity: active people weeklyCapacityDays x 12 weeks
  const totalCapacity = useMemo(
    () => activePeople.reduce((sum, p) => sum + p.weeklyCapacityDays, 0) * weeks.length,
    [activePeople, weeks]
  );

  // Total assigned days in range
  const totalAssigned = useMemo(
    () => allocations.filter((a) => allDates.has(a.date)).reduce((sum, a) => sum + a.days, 0),
    [allocations, allDates]
  );

  const utilizationPct = totalCapacity > 0
    ? Math.round((totalAssigned / totalCapacity) * 100)
    : 0;

  return (
    <div className="dashboard-summary-strip">
      <div className="summary-card summary-card--scenario">
        <span className="summary-card-label">Scenario</span>
        <span className="summary-card-value">
          {scenario?.name || 'Unknown'}
          {scenario?.isBase && <span className="summary-base-badge">Base</span>}
        </span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Date Range</span>
        <span className="summary-card-value">{dateRangeLabel}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Team Size</span>
        <span className="summary-card-value">{activePeople.length}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Capacity</span>
        <span className="summary-card-value">{totalCapacity}d</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Assigned</span>
        <span className="summary-card-value">{totalAssigned}d</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Utilization</span>
        <span className={`summary-card-value ${
          utilizationPct >= 80 ? 'summary-value--high'
            : utilizationPct >= 50 ? 'summary-value--mid'
              : 'summary-value--low'
        }`}>
          {utilizationPct}%
        </span>
      </div>
    </div>
  );
}

/* ---- Gantt Timeline ---- */

function DashboardGantt({
  workItems,
  pods,
  weeks,
}: {
  workItems: WorkItem[];
  pods: { id: string; name: string }[];
  weeks: WeekInfo[];
}) {
  // Group work items by pod
  const ganttByPod = useMemo(() => {
    const podGroups: Record<string, WorkItem[]> = {};
    for (const wi of workItems) {
      if (!podGroups[wi.podId]) podGroups[wi.podId] = [];
      podGroups[wi.podId].push(wi);
    }
    return podGroups;
  }, [workItems]);

  // Gantt timeline range
  const ganttStart = weeks[0]?.weekStart;
  const lastWeek = weeks[weeks.length - 1];
  const ganttEnd = lastWeek?.weekdays[lastWeek.weekdays.length - 1];
  const ganttTotalDays = ganttStart && ganttEnd
    ? differenceInCalendarDays(ganttEnd, ganttStart) + 1
    : 1;

  // Today marker position
  const todayDate = today();
  const todayOffsetDays = ganttStart
    ? differenceInCalendarDays(todayDate, ganttStart)
    : -1;
  const todayPct = todayOffsetDays >= 0 && todayOffsetDays <= ganttTotalDays
    ? (todayOffsetDays / ganttTotalDays) * 100
    : -1;

  return (
    <section className="dashboard-section">
      <h3 className="dashboard-section-title">Timeline</h3>
      <div className="gantt-container">
        {/* Week headers */}
        <div className="gantt-header">
          <div className="gantt-label-col">Work Item</div>
          <div className="gantt-timeline-col">
            <div className="gantt-week-headers">
              {weeks.map((w) => (
                <div
                  key={w.weekStartStr}
                  className="gantt-week-header"
                  style={{ width: `${(w.weekdays.length / ganttTotalDays) * 100}%` }}
                >
                  {w.weekLabel}
                </div>
              ))}
            </div>
            {/* Today marker in header */}
            {todayPct >= 0 && (
              <div
                className="gantt-today-line gantt-today-line--header"
                style={{ left: `${todayPct}%` }}
              />
            )}
          </div>
        </div>

        {/* Pod groups */}
        {pods.map((pod) => {
          const items = ganttByPod[pod.id];
          if (!items || items.length === 0) return null;
          const podColor = getPodColor(pod.id);
          return (
            <div key={pod.id} className="gantt-pod-group">
              <div
                className="gantt-pod-header"
                style={{ borderLeft: `3px solid ${podColor}` }}
              >
                {pod.name}
              </div>
              {items.map((wi) => {
                const start = fromDateStr(wi.startDate);
                const end = fromDateStr(wi.endDate);
                const offsetDays = Math.max(
                  0,
                  differenceInCalendarDays(start, ganttStart!)
                );
                const spanDays = differenceInCalendarDays(end, start) + 1;
                const leftPct = (offsetDays / ganttTotalDays) * 100;
                const widthPct = (spanDays / ganttTotalDays) * 100;

                return (
                  <div key={wi.id} className="gantt-row">
                    <div className="gantt-label-col" title={wi.name}>
                      {getWorkItemLabel(wi)}
                    </div>
                    <div className="gantt-timeline-col">
                      {todayPct >= 0 && (
                        <div
                          className="gantt-today-line"
                          style={{ left: `${todayPct}%` }}
                        />
                      )}
                      <div
                        className="gantt-bar"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          background: `${podColor}22`,
                          borderColor: podColor,
                        }}
                        title={`${wi.name}: ${formatDate(start)} \u2013 ${formatDate(end)}`}
                      >
                        <span className="gantt-bar-label">{wi.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---- Pod-Grouped People List ---- */

function DashboardPeople({
  people,
  pods,
  allocations,
  workItems,
  activeWeekDates,
  activeWeekLabel,
  showArchived,
  podFilterIds,
}: {
  people: Person[];
  pods: { id: string; name: string }[];
  allocations: Allocation[];
  workItems: WorkItem[];
  activeWeekDates: Set<string>;
  activeWeekLabel: string;
  showArchived: boolean;
  podFilterIds: string[];
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  // Filter people — same logic as RosterGrid
  const visiblePeople = useMemo(
    () => showArchived ? people : people.filter((p) => p.status !== 'archived'),
    [people, showArchived]
  );

  // Build pod groups — same as RosterGrid
  const podGroups = useMemo(
    () => buildPodGroups(visiblePeople, pods, allocations, workItems),
    [visiblePeople, pods, allocations, workItems]
  );

  // Apply pod filter — same logic as RosterGrid
  const filteredGroups = useMemo(() => {
    if (podFilterIds.length === 0) return podGroups;
    return podGroups.filter((g) => {
      // Always show QA lead group
      if (g.pods.some((sg) => sg.pod.id === '__qa_lead__')) return true;
      // Show group if any of its pods match the filter
      return g.pods.some((sg) => podFilterIds.includes(sg.pod.id));
    });
  }, [podGroups, podFilterIds]);

  // WorkItemId -> PodId map
  const wiPodMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const wi of workItems) map[wi.id] = wi.podId;
    return map;
  }, [workItems]);

  // WorkItemId -> WorkItem map
  const wiMap = useMemo(() => {
    const map: Record<string, WorkItem> = {};
    for (const wi of workItems) map[wi.id] = wi;
    return map;
  }, [workItems]);

  return (
    <section className="dashboard-section">
      <h3 className="dashboard-section-title">
        Team Assignments
        <span className="dashboard-section-subtitle">{activeWeekLabel}</span>
      </h3>

      {filteredGroups.map((group) => {
        const collapsed = collapsedGroups.has(group.label);
        return (
          <div key={group.label} className="dashboard-group">
            <div
              className="dashboard-group-header"
              onClick={() => toggleGroup(group.label)}
            >
              <span className={`group-collapse-icon ${collapsed ? 'collapsed' : ''}`}>
                ▾
              </span>
              <span className="dashboard-group-label">{group.label}</span>
              <span className="dashboard-group-count">
                {group.pods.reduce((sum, sg) => sum + sg.people.length, 0)} people
              </span>
            </div>

            {!collapsed && (
              <div className="dashboard-group-body">
                {group.pods.map((subgroup) => (
                  <div key={subgroup.pod.id}>
                    {group.pods.length > 1 && !subgroup.pod.id.startsWith('__') && (
                      <div className="dashboard-subgroup-header">{subgroup.pod.name}</div>
                    )}
                    {subgroup.people.map((person) => (
                      <DashboardPersonCard
                        key={person.id}
                        person={person}
                        activeWeekDates={activeWeekDates}
                        allocations={allocations}
                        wiPodMap={wiPodMap}
                        wiMap={wiMap}
                        pods={pods}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* ---- Person Card ---- */

function DashboardPersonCard({
  person,
  activeWeekDates,
  allocations,
  wiPodMap,
  wiMap,
  pods,
}: {
  person: Person;
  activeWeekDates: Set<string>;
  allocations: Allocation[];
  wiPodMap: Record<string, string>;
  wiMap: Record<string, WorkItem>;
  pods: { id: string; name: string }[];
}) {
  const isArchived = person.status === 'archived';

  // Pod breakdown for active week — same selector as RosterGrid
  const breakdown = useMemo(
    () => getPersonWeekPodBreakdown(person.id, activeWeekDates, allocations, wiPodMap, pods),
    [person.id, activeWeekDates, allocations, wiPodMap, pods]
  );

  // Build assignment summary text: group allocations by work item
  const weekSummary = useMemo(() => {
    const wiDays: Record<string, number> = {};
    for (const a of allocations) {
      if (a.personId !== person.id) continue;
      if (!activeWeekDates.has(a.date)) continue;
      wiDays[a.workItemId] = (wiDays[a.workItemId] || 0) + a.days;
    }

    if (Object.keys(wiDays).length === 0) return null;

    return Object.entries(wiDays)
      .sort((a, b) => b[1] - a[1])
      .map(([wiId, days]) => {
        const wi = wiMap[wiId];
        const label = wi ? getWorkItemLabel(wi) : '?';
        return `${label} (${days}d)`;
      });
  }, [person.id, activeWeekDates, allocations, wiMap]);

  const roleLabel = person.role === 'qa_lead'
    ? 'QA Lead'
    : person.role === 'pod_lead'
      ? 'Pod Lead'
      : 'Tester';

  // Dominant pod color
  const chipColor = breakdown.topPodId ? getPodColor(breakdown.topPodId) : undefined;

  return (
    <div className={`dashboard-person-card ${isArchived ? 'dashboard-person-card--archived' : ''}`}>
      <div className="dashboard-person-info">
        <span className="dashboard-person-name">{person.name}</span>
        <span className={`dashboard-role-badge dashboard-role-badge--${person.role}`}>
          {roleLabel}
        </span>
        <span className={`dashboard-type-badge dashboard-type-badge--${person.type}`}>
          {person.type === 'internal' ? 'Int' : 'Vnd'}
        </span>
        {isArchived && <span className="dashboard-archived-badge">Archived</span>}
      </div>
      <div className="dashboard-person-assignments">
        {weekSummary ? (
          <>
            {chipColor && (
              <span
                className="dashboard-pod-dot"
                style={{ background: chipColor }}
              />
            )}
            <span className="dashboard-week-summary">
              {weekSummary.join(', ')}
            </span>
          </>
        ) : (
          <span className="dashboard-week-summary dashboard-week-summary--available">
            Available
          </span>
        )}
      </div>
    </div>
  );
}
