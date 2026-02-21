import type {
  Allocation,
  WorkItem,
  Person,
  RiskLevel,
  CoverageRisk,
  FeasibilityRisk,
  ContextSwitchingRisk,
  CapacityRisk,
} from '../types';
import {
  getWeekStart,
  toDateStr,
  fromDateStr,
  isDateInRange,
  getPlanningWeeks,
  getWeekdaysInRange,
} from './dates';
import { isBefore, isAfter, isSameDay, addWeeks } from 'date-fns';

function getWeekStartStr(dateStr: string): string {
  return toDateStr(getWeekStart(fromDateStr(dateStr)));
}

export function computeCoverageRisks(
  workItems: WorkItem[],
  allocations: Allocation[],
  weeks: ReturnType<typeof getPlanningWeeks>
): CoverageRisk[] {
  const risks: CoverageRisk[] = [];

  for (const wi of workItems) {
    for (const week of weeks) {
      const weekStartStr = toDateStr(week.weekStart);
      // Check if this week overlaps with the work item window
      const weekDays = week.weekdays.map(toDateStr);
      const overlapDays = weekDays.filter((d) =>
        isDateInRange(d, wi.startDate, wi.endDate)
      );
      if (overlapDays.length === 0) continue;

      const planned = allocations.filter(
        (a) =>
          a.workItemId === wi.id &&
          overlapDays.includes(a.date)
      ).reduce((sum, a) => sum + a.days, 0);

      const required = wi.requiredMinDaysPerWeek;
      let level: RiskLevel = 'green';
      if (planned < 0.6 * required) {
        level = 'red';
      } else if (planned < required) {
        level = 'yellow';
      }

      risks.push({
        workItemId: wi.id,
        weekStart: weekStartStr,
        planned,
        required,
        level,
      });
    }
  }

  return risks;
}

export function computeFeasibilityRisks(
  workItems: WorkItem[],
  allocations: Allocation[],
  weeks: ReturnType<typeof getPlanningWeeks>
): FeasibilityRisk[] {
  const risks: FeasibilityRisk[] = [];
  const now = toDateStr(new Date());

  for (const wi of workItems) {
    // Count remaining weeks within the work item window
    const remainingWeeks = weeks.filter((w) => {
      const weekDays = w.weekdays.map(toDateStr);
      return weekDays.some(
        (d) => isDateInRange(d, wi.startDate, wi.endDate) && d >= now
      );
    });

    if (remainingWeeks.length === 0) continue;

    const remainingRequired =
      wi.requiredMinDaysPerWeek * remainingWeeks.length;

    const remainingDates = remainingWeeks.flatMap((w) =>
      w.weekdays.map(toDateStr).filter(
        (d) => isDateInRange(d, wi.startDate, wi.endDate) && d >= now
      )
    );

    const remainingPlanned = allocations
      .filter(
        (a) =>
          a.workItemId === wi.id && remainingDates.includes(a.date)
      )
      .reduce((sum, a) => sum + a.days, 0);

    let level: RiskLevel = 'green';
    if (remainingPlanned < 0.6 * remainingRequired) {
      level = 'red';
    } else if (remainingPlanned < remainingRequired) {
      level = 'yellow';
    }

    risks.push({
      workItemId: wi.id,
      remainingRequired,
      remainingPlanned,
      level,
    });
  }

  return risks;
}

export function computeContextSwitchingRisks(
  people: Person[],
  allocations: Allocation[],
  weeks: ReturnType<typeof getPlanningWeeks>
): ContextSwitchingRisk[] {
  const risks: ContextSwitchingRisk[] = [];

  for (const person of people) {
    for (const week of weeks) {
      const weekDays = week.weekdays.map(toDateStr);
      const personAllocsThisWeek = allocations.filter(
        (a) => a.personId === person.id && weekDays.includes(a.date)
      );

      const distinctWorkItems = new Set(
        personAllocsThisWeek.map((a) => a.workItemId)
      ).size;

      let level: RiskLevel = 'green';
      if (distinctWorkItems >= 6) {
        level = 'red';
      } else if (distinctWorkItems >= 4) {
        level = 'yellow';
      }

      if (level !== 'green') {
        risks.push({
          personId: person.id,
          weekStart: toDateStr(week.weekStart),
          distinctWorkItems,
          level,
        });
      }
    }
  }

  return risks;
}

export function computeCapacityRisks(
  people: Person[],
  allocations: Allocation[],
  weeks: ReturnType<typeof getPlanningWeeks>
): CapacityRisk[] {
  const risks: CapacityRisk[] = [];

  for (const person of people) {
    const cap = person.weeklyCapacityDays;

    for (const week of weeks) {
      const weekDays = week.weekdays.map(toDateStr);
      const assignedDays = allocations
        .filter(
          (a) => a.personId === person.id && weekDays.includes(a.date)
        )
        .reduce((sum, a) => sum + a.days, 0);

      let level: RiskLevel = 'green';
      if (assignedDays >= 6) {
        level = 'red';
      } else if (assignedDays > 5) {
        level = 'yellow';
      }

      if (level !== 'green') {
        risks.push({
          personId: person.id,
          weekStart: toDateStr(week.weekStart),
          assignedDays,
          cap,
          level,
        });
      }
    }
  }

  return risks;
}

export function getWorstRisk(levels: RiskLevel[]): RiskLevel {
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}
