import { useMemo } from 'react';
import { useStore } from '../../store';
import { getPlanningWeeks, toDateStr, fromDateStr, formatDate } from '../../utils/dates';
import {
  computeCoverageRisks,
  computeFeasibilityRisks,
  getWorstRisk,
} from '../../utils/risks';
import { getWorkItemLabel, getPodName } from '../../utils/helpers';
import type { RiskLevel, WorkItem } from '../../types';
import { differenceInCalendarDays } from 'date-fns';

export function DashboardScreen() {
  const workItems = useStore((s) => s.workItems);
  const allocations = useStore((s) => s.allocations);
  const pods = useStore((s) => s.pods);
  const people = useStore((s) => s.people);

  const weeks = useMemo(() => getPlanningWeeks(12), []);
  const next2Weeks = useMemo(() => weeks.slice(0, 2), [weeks]);

  // Coverage risks for next 2 weeks
  const coverageRisks = useMemo(
    () => computeCoverageRisks(workItems, allocations, next2Weeks),
    [workItems, allocations, next2Weeks]
  );

  // Feasibility risks
  const feasibilityRisks = useMemo(
    () => computeFeasibilityRisks(workItems, allocations, weeks),
    [workItems, allocations, weeks]
  );

  // Build risk list per work item
  const workItemRisks = useMemo(() => {
    const results: {
      workItem: WorkItem;
      coverageLevels: RiskLevel[];
      feasibilityLevel: RiskLevel;
      worstLevel: RiskLevel;
    }[] = [];

    for (const wi of workItems) {
      const covRisks = coverageRisks
        .filter((r) => r.workItemId === wi.id)
        .map((r) => r.level);
      const feasRisk = feasibilityRisks.find((r) => r.workItemId === wi.id);
      const allLevels = [...covRisks, feasRisk?.level || 'green'];
      const worst = getWorstRisk(allLevels);

      results.push({
        workItem: wi,
        coverageLevels: covRisks,
        feasibilityLevel: feasRisk?.level || 'green',
        worstLevel: worst,
      });
    }

    // Sort: red first, then yellow, then green
    const order = { red: 0, yellow: 1, green: 2 };
    results.sort((a, b) => order[a.worstLevel] - order[b.worstLevel]);
    return results;
  }, [workItems, coverageRisks, feasibilityRisks]);

  // Only show items with risks
  const riskyItems = workItemRisks.filter((r) => r.worstLevel !== 'green');

  // Gantt data
  const ganttByPod = useMemo(() => {
    const podGroups: Record<string, WorkItem[]> = {};
    for (const wi of workItems) {
      if (!podGroups[wi.podId]) podGroups[wi.podId] = [];
      podGroups[wi.podId].push(wi);
    }
    return podGroups;
  }, [workItems]);

  // Work item risk map for Gantt coloring
  const wiRiskMap = useMemo(() => {
    const map: Record<string, RiskLevel> = {};
    for (const r of workItemRisks) {
      map[r.workItem.id] = r.worstLevel;
    }
    return map;
  }, [workItemRisks]);

  // Gantt timeline range
  const ganttStart = weeks[0]?.weekStart;
  const ganttEnd = weeks[weeks.length - 1]?.weekdays[weeks[weeks.length - 1].weekdays.length - 1];
  const ganttTotalDays = ganttStart && ganttEnd
    ? differenceInCalendarDays(ganttEnd, ganttStart) + 1
    : 1;

  return (
    <div className="dashboard-screen">
      <h2>Dashboard</h2>

      <div className="dashboard-sections">
        {/* Risk List */}
        <section className="dashboard-section">
          <h3>Risk Summary (Next 2 Weeks)</h3>
          {riskyItems.length === 0 ? (
            <p className="no-risks">No risks detected. All work items are on track.</p>
          ) : (
            <table className="risk-table">
              <thead>
                <tr>
                  <th>Work Item</th>
                  <th>Pod</th>
                  <th>Coverage</th>
                  <th>Feasibility</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {riskyItems.map((r) => (
                  <tr key={r.workItem.id}>
                    <td>{r.workItem.name}</td>
                    <td>{getPodName(pods, r.workItem.podId)}</td>
                    <td>
                      <span className={`risk-dot risk-dot--${getWorstRisk(r.coverageLevels)}`} />
                      {getWorstRisk(r.coverageLevels)}
                    </td>
                    <td>
                      <span className={`risk-dot risk-dot--${r.feasibilityLevel}`} />
                      {r.feasibilityLevel}
                    </td>
                    <td>
                      <span className={`risk-dot risk-dot--${r.worstLevel}`} />
                      {r.worstLevel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Gantt Timeline */}
        <section className="dashboard-section">
          <h3>Timeline</h3>
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
                      style={{
                        width: `${(w.weekdays.length / ganttTotalDays) * 100}%`,
                      }}
                    >
                      {w.weekLabel}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pod groups */}
            {pods.map((pod) => {
              const items = ganttByPod[pod.id];
              if (!items || items.length === 0) return null;
              return (
                <div key={pod.id} className="gantt-pod-group">
                  <div className="gantt-pod-header">{pod.name}</div>
                  {items.map((wi) => {
                    const start = fromDateStr(wi.startDate);
                    const end = fromDateStr(wi.endDate);
                    const offsetDays = Math.max(
                      0,
                      differenceInCalendarDays(start, ganttStart!)
                    );
                    const spanDays =
                      differenceInCalendarDays(end, start) + 1;
                    const leftPct =
                      (offsetDays / ganttTotalDays) * 100;
                    const widthPct =
                      (spanDays / ganttTotalDays) * 100;
                    const risk = wiRiskMap[wi.id] || 'green';

                    return (
                      <div key={wi.id} className="gantt-row">
                        <div className="gantt-label-col" title={wi.name}>
                          {getWorkItemLabel(wi)}
                        </div>
                        <div className="gantt-timeline-col">
                          <div
                            className={`gantt-bar gantt-bar--${risk}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            title={`${formatDate(start)} - ${formatDate(end)}`}
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
      </div>
    </div>
  );
}
