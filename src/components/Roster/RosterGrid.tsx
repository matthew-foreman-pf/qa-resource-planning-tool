import { useMemo, useState, memo, useCallback } from 'react';
import { useStore } from '../../store';
import { getPlanningWeeks, toDateStr, formatDayHeader } from '../../utils/dates';
import {
  getWorkItemLabel,
  getPersonWeekPodBreakdown,
  getPersonWeekCrossPodBreakdown,
  isCrossPodAllocation,
  getPodName,
  getPodPrefix,
} from '../../utils/helpers';
import type { PersonWeekPodBreakdown, PersonWeekCrossPodBreakdown } from '../../utils/helpers';
import { buildPodGroups, computeGroupWeeklySummary } from '../../utils/grouping';
import type { Allocation, WorkItem, Person, Pod, PodGroup, PodSubgroup } from '../../types';
import type { WeekInfo } from '../../utils/dates';

export function RosterGrid() {
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const workItems = useStore((s) => s.workItems);
  const allocations = useStore((s) => s.allocations);
  const timeOffs = useStore((s) => s.timeOffs);
  const selectCell = useStore((s) => s.selectCell);
  const openPersonDrawer = useStore((s) => s.openPersonDrawer);
  const showArchivedPeople = useStore((s) => s.showArchivedPeople);
  const podFilterIds = useStore((s) => s.podFilterIds);
  const editMode = useStore((s) => s.editMode);
  const selectedCells = useStore((s) => s.selectedCells);
  const toggleCellSelection = useStore((s) => s.toggleCellSelection);
  const activeWeekStartDate = useStore((s) => s.activeWeekStartDate);
  const setActiveWeekStartDate = useStore((s) => s.setActiveWeekStartDate);

  // In edit mode, clicking a cell toggles selection; otherwise opens day drawer
  const handleCellClick = useCallback(
    (personId: string, date: string) => {
      if (editMode) {
        toggleCellSelection(personId, date);
      } else {
        selectCell(personId, date);
      }
    },
    [editMode, toggleCellSelection, selectCell]
  );

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

  // WorkItemId -> PodId map for pod breakdown
  const wiPodMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const wi of workItems) map[wi.id] = wi.podId;
    return map;
  }, [workItems]);

  const timeOffSet = useMemo(() => {
    const set = new Set<string>();
    for (const to of timeOffs) {
      set.add(`${to.personId}|${to.date}`);
    }
    return set;
  }, [timeOffs]);

  // Active week date set for pod breakdown
  const activeWeekDates = useMemo(() => {
    const week = weeks.find((w) => w.weekStartStr === activeWeekStartDate);
    if (!week) return new Set<string>();
    return new Set(week.weekdays.map(toDateStr));
  }, [weeks, activeWeekStartDate]);

  // Filter people based on visibility
  const visiblePeople = useMemo(() => {
    if (showArchivedPeople) return people;
    return people.filter((p) => p.status !== 'archived');
  }, [people, showArchivedPeople]);

  // Build pod groups from visible people
  const podGroups = useMemo(
    () => buildPodGroups(visiblePeople, pods, allocations, workItems),
    [visiblePeople, pods, allocations, workItems]
  );

  // Filter groups by pod filter
  const filteredGroups = useMemo(() => {
    if (podFilterIds.length === 0) return podGroups;
    return podGroups.filter((g) => {
      // Always show QA lead group
      if (g.pods.some((sg) => sg.pod.id === '__qa_lead__')) return true;
      // Show group if any of its pods match the filter
      return g.pods.some((sg) => podFilterIds.includes(sg.pod.id));
    });
  }, [podGroups, podFilterIds]);

  // Current week for group summary
  const currentWeek = weeks[0];

  const totalDays = weeks.reduce((sum, w) => sum + w.weekdays.length, 0);

  // Collapse state: group label -> collapsed
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

  return (
    <div className="roster-container">
      <div
        className="roster-grid"
        style={{ gridTemplateColumns: `200px repeat(${totalDays}, 1fr)` }}
      >
        {/* Header row: week headers */}
        <div className="roster-header-cell roster-name-header">Person</div>
        {weeks.map((week) =>
          week.weekdays.map((day, di) => {
            const isActiveWeek = week.weekStartStr === activeWeekStartDate;
            return (
              <div
                key={toDateStr(day)}
                className={`roster-header-cell ${di === 0 ? 'roster-week-start' : ''} ${isActiveWeek ? 'roster-header-cell--active-week' : ''}`}
                title={`${week.weekLabel} (click to set active week)`}
                onClick={() => setActiveWeekStartDate(week.weekStartStr)}
              >
                <span className="roster-day-label">{formatDayHeader(day)}</span>
                {di === 0 && (
                  <span className={`roster-week-label ${isActiveWeek ? 'roster-week-label--active' : ''}`}>
                    {week.weekLabel}
                    {isActiveWeek && ' ●'}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Pod groups */}
        {filteredGroups.map((group) => (
          <PodGroupSection
            key={group.label}
            group={group}
            weeks={weeks}
            totalDays={totalDays}
            currentWeek={currentWeek}
            allocations={allocations}
            workItems={workItems}
            allocByPersonDate={allocByPersonDate}
            wiMap={wiMap}
            wiPodMap={wiPodMap}
            pods={pods}
            activeWeekDates={activeWeekDates}
            timeOffSet={timeOffSet}
            onCellClick={handleCellClick}
            onNameClick={openPersonDrawer}
            collapsed={collapsedGroups.has(group.label)}
            onToggleCollapse={toggleGroup}
            editMode={editMode}
            selectedCells={selectedCells}
          />
        ))}
      </div>
    </div>
  );
}

/* ---- Group Section ---- */

function PodGroupSection({
  group,
  weeks,
  totalDays,
  currentWeek,
  allocations,
  workItems,
  allocByPersonDate,
  wiMap,
  wiPodMap,
  pods,
  activeWeekDates,
  timeOffSet,
  onCellClick,
  onNameClick,
  collapsed,
  onToggleCollapse,
  editMode,
  selectedCells,
}: {
  group: PodGroup;
  weeks: WeekInfo[];
  totalDays: number;
  currentWeek: WeekInfo;
  allocations: Allocation[];
  workItems: WorkItem[];
  allocByPersonDate: Record<string, Allocation[]>;
  wiMap: Record<string, WorkItem>;
  wiPodMap: Record<string, string>;
  pods: Pod[];
  activeWeekDates: Set<string>;
  timeOffSet: Set<string>;
  onCellClick: (personId: string, date: string) => void;
  onNameClick: (personId: string) => void;
  collapsed: boolean;
  onToggleCollapse: (label: string) => void;
  editMode: boolean;
  selectedCells: Set<string>;
}) {
  const summary = useMemo(
    () => computeGroupWeeklySummary(group, allocations, workItems, currentWeek),
    [group, allocations, workItems, currentWeek]
  );

  return (
    <>
      {/* Group header row — spans full grid */}
      <div
        className="roster-group-header"
        style={{ gridColumn: `1 / span ${totalDays + 1}` }}
        onClick={() => onToggleCollapse(group.label)}
      >
        <div className="group-header-left">
          <span className={`group-collapse-icon ${collapsed ? 'collapsed' : ''}`}>▾</span>
          <span className="group-header-label">{group.label}</span>
        </div>
        <div className="group-header-right">
          <span className="group-stat">
            {summary.assignedDays.toFixed(1)} / {summary.totalCapDays.toFixed(1)}d
          </span>
          {summary.redCount > 0 && (
            <span className="group-risk-badge group-risk-badge--red">
              {summary.redCount} red
            </span>
          )}
          {summary.yellowCount > 0 && (
            <span className="group-risk-badge group-risk-badge--yellow">
              {summary.yellowCount} yellow
            </span>
          )}
          {summary.redCount === 0 && summary.yellowCount === 0 && (
            <span className="group-risk-badge group-risk-badge--green">✓ OK</span>
          )}
        </div>
      </div>

      {!collapsed &&
        group.pods.map((subgroup) => (
          <PodSubgroupSection
            key={subgroup.pod.id}
            subgroup={subgroup}
            showSubheader={group.pods.length > 1 && !subgroup.pod.id.startsWith('__')}
            weeks={weeks}
            totalDays={totalDays}
            allocByPersonDate={allocByPersonDate}
            wiMap={wiMap}
            wiPodMap={wiPodMap}
            pods={pods}
            allocations={allocations}
            activeWeekDates={activeWeekDates}
            timeOffSet={timeOffSet}
            onCellClick={onCellClick}
            onNameClick={onNameClick}
            editMode={editMode}
            selectedCells={selectedCells}
          />
        ))}
    </>
  );
}

/* ---- Subgroup Section ---- */

function PodSubgroupSection({
  subgroup,
  showSubheader,
  weeks,
  totalDays,
  allocByPersonDate,
  wiMap,
  wiPodMap,
  pods,
  allocations,
  activeWeekDates,
  timeOffSet,
  onCellClick,
  onNameClick,
  editMode,
  selectedCells,
}: {
  subgroup: PodSubgroup;
  showSubheader: boolean;
  weeks: WeekInfo[];
  totalDays: number;
  allocByPersonDate: Record<string, Allocation[]>;
  wiMap: Record<string, WorkItem>;
  wiPodMap: Record<string, string>;
  pods: Pod[];
  allocations: Allocation[];
  activeWeekDates: Set<string>;
  timeOffSet: Set<string>;
  onCellClick: (personId: string, date: string) => void;
  onNameClick: (personId: string) => void;
  editMode: boolean;
  selectedCells: Set<string>;
}) {
  return (
    <>
      {showSubheader && (
        <div
          className="roster-subgroup-header"
          style={{ gridColumn: `1 / span ${totalDays + 1}` }}
        >
          {subgroup.pod.name}
        </div>
      )}
      {subgroup.people.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          weeks={weeks}
          allocByPersonDate={allocByPersonDate}
          wiMap={wiMap}
          wiPodMap={wiPodMap}
          pods={pods}
          allocations={allocations}
          activeWeekDates={activeWeekDates}
          timeOffSet={timeOffSet}
          onCellClick={onCellClick}
          onNameClick={onNameClick}
          editMode={editMode}
          selectedCells={selectedCells}
        />
      ))}
    </>
  );
}

/* ---- Icons ---- */

function PencilIcon() {
  return (
    <svg className="pencil-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---- Person Row (memoized) ---- */

const PersonRow = memo(function PersonRow({
  person,
  weeks,
  allocByPersonDate,
  wiMap,
  wiPodMap,
  pods,
  allocations,
  activeWeekDates,
  timeOffSet,
  onCellClick,
  onNameClick,
  editMode,
  selectedCells,
}: {
  person: Person;
  weeks: WeekInfo[];
  allocByPersonDate: Record<string, Allocation[]>;
  wiMap: Record<string, WorkItem>;
  wiPodMap: Record<string, string>;
  pods: Pod[];
  allocations: Allocation[];
  activeWeekDates: Set<string>;
  timeOffSet: Set<string>;
  onCellClick: (personId: string, date: string) => void;
  onNameClick: (personId: string) => void;
  editMode: boolean;
  selectedCells: Set<string>;
}) {
  const isArchived = person.status === 'archived';

  // Pod breakdown for the active week
  const breakdown = useMemo(
    () => getPersonWeekPodBreakdown(person.id, activeWeekDates, allocations, wiPodMap, pods),
    [person.id, activeWeekDates, allocations, wiPodMap, pods]
  );

  // Cross-pod breakdown for the active week
  const crossPodBreakdown = useMemo(
    () => getPersonWeekCrossPodBreakdown(person.id, person.homePodId, activeWeekDates, allocations, wiPodMap, pods),
    [person.id, person.homePodId, activeWeekDates, allocations, wiPodMap, pods]
  );

  // Build tooltip text for pod breakdown
  const chipTooltip = useMemo(() => {
    if (breakdown.entries.length === 0) return 'No allocations this week';
    return breakdown.entries
      .map((e) => `${e.podName}: ${e.days}d`)
      .join(', ');
  }, [breakdown]);

  // Build tooltip text for cross-pod chip
  const crossPodTooltip = useMemo(() => {
    if (crossPodBreakdown.entries.length === 0) return '';
    const homeName = person.homePodId ? getPodPrefix(person.homePodId) : '?';
    return `Home: ${homeName} | Cross-pod: ${crossPodBreakdown.entries.map((e) => `${e.podName} (${e.days}d)`).join(', ')}`;
  }, [crossPodBreakdown, person.homePodId]);

  return (
    <>
      <div
        className={`roster-name-cell ${person.type === 'vendor' ? 'roster-name-cell--vendor' : ''} ${isArchived ? 'roster-name-cell--archived' : ''}`}
        onClick={() => onNameClick(person.id)}
      >
        <div className="person-name-row">
          <span className="person-name">{person.name}</span>
          <PencilIcon />
        </div>
        <div className="person-meta-row">
          <span className="person-role">
            {person.role === 'qa_lead'
              ? 'QA Lead'
              : person.role === 'pod_lead'
                ? 'Pod Lead'
                : 'Tester'}
            {isArchived && <span className="archived-badge">Archived</span>}
          </span>
          <PodChip breakdown={breakdown} tooltip={chipTooltip} />
          {crossPodBreakdown.totalCrossPodDays > 0 && (
            <span className="cross-pod-chip" title={crossPodTooltip}>
              ✦ Cross: {crossPodBreakdown.totalCrossPodDays}d
            </span>
          )}
        </div>
      </div>
      {weeks.map((week) =>
        week.weekdays.map((day, di) => {
          const dateStr = toDateStr(day);
          const key = `${person.id}|${dateStr}`;
          const allocs = allocByPersonDate[key] || [];
          const isOff = timeOffSet.has(key);
          const isSelected = editMode && selectedCells.has(key);

          // If archived and date is after archivedAt, grey out
          const isPastArchive =
            isArchived && person.archivedAt && dateStr > person.archivedAt;

          // Check if any allocation on this cell is cross-pod
          const hasCrossPod =
            !isPastArchive &&
            !isOff &&
            allocs.length > 0 &&
            allocs.some((a) => isCrossPodAllocation(a, person, wiPodMap));

          let cellClass = 'roster-cell';
          if (di === 0) cellClass += ' roster-week-start';
          if (isPastArchive) {
            cellClass += ' roster-cell--disabled';
          } else if (isOff) {
            cellClass += ' roster-cell--timeoff';
          } else if (allocs.length > 0) {
            cellClass += person.type === 'vendor'
              ? ' roster-cell--assigned-vendor'
              : ' roster-cell--assigned';
          } else {
            cellClass += ' roster-cell--available';
          }
          if (hasCrossPod) cellClass += ' roster-cell--cross-pod';
          if (isArchived) cellClass += ' roster-cell--archived';
          if (isSelected) cellClass += ' roster-cell--selected';
          if (editMode && !isPastArchive) cellClass += ' roster-cell--edit-mode';

          const wiNames = allocs.map((a) => {
            const wi = wiMap[a.workItemId];
            return wi ? getWorkItemLabel(wi) : '?';
          });

          // Build cross-pod tooltip info
          let cellTitle: string;
          if (isPastArchive) {
            cellTitle = 'Archived';
          } else if (isOff) {
            cellTitle = 'Time Off';
          } else if (allocs.length > 0) {
            const lines = wiNames.join(', ');
            if (hasCrossPod && person.homePodId) {
              const homeName = getPodName(pods, person.homePodId);
              const crossItems = allocs
                .filter((a) => isCrossPodAllocation(a, person, wiPodMap))
                .map((a) => {
                  const wi = wiMap[a.workItemId];
                  const assignedPod = wi ? getPodName(pods, wi.podId) : '?';
                  return `  → ${wi ? getWorkItemLabel(wi) : '?'} (${assignedPod})`;
                });
              cellTitle = `${lines}\n\n✦ Cross-pod (Home: ${homeName}):\n${crossItems.join('\n')}`;
            } else {
              cellTitle = lines;
            }
          } else {
            cellTitle = 'Available';
          }

          return (
            <div
              key={dateStr}
              className={cellClass}
              onClick={() => !isPastArchive && onCellClick(person.id, dateStr)}
              title={cellTitle}
            >
              {isSelected && (
                <span className="cell-check">✓</span>
              )}
              {isPastArchive ? null : isOff ? (
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
});

/* ---- Pod Chip ---- */

function PodChip({ breakdown, tooltip }: { breakdown: PersonWeekPodBreakdown; tooltip: string }) {
  if (breakdown.totalDays === 0) {
    return (
      <span className="pod-chip-week pod-chip-week--available" title={tooltip}>
        Available
      </span>
    );
  }

  if (breakdown.topPodDays >= 4) {
    // Dominant pod
    const top = breakdown.entries[0];
    return (
      <span
        className="pod-chip-week"
        style={{ background: top.color }}
        title={tooltip}
      >
        On: {top.podName} ({top.days}d)
      </span>
    );
  }

  // Split across pods
  return (
    <span className="pod-chip-week pod-chip-week--split" title={tooltip}>
      {breakdown.entries.map((e, i) => (
        <span key={e.podId}>
          {i > 0 && ', '}
          <span style={{ color: e.color, fontWeight: 700 }}>{e.podName}</span>
          {' '}({e.days}d)
        </span>
      ))}
    </span>
  );
}
