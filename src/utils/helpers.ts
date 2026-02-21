import type { Pod, WorkItem, Allocation, Person } from '../types';

const podPrefixMap: Record<string, string> = {
  'pod-ww': 'WW',
  'pod-ps': 'PS',
  'pod-tp': 'TP',
  'pod-ss': 'SS',
  'pod-la': 'LA',
};

export function getPodPrefix(podId: string): string {
  return podPrefixMap[podId] || podId.slice(0, 2).toUpperCase();
}

export function getWorkItemLabel(wi: WorkItem): string {
  return `${getPodPrefix(wi.podId)}: ${wi.name}`;
}

export function getPodName(pods: Pod[], podId: string): string {
  return pods.find((p) => p.id === podId)?.name || podId;
}

/** Pod accent colors for chips (dark theme friendly) */
export const POD_COLORS: Record<string, string> = {
  'pod-ww': '#5b8a72',
  'pod-ps': '#6b7db5',
  'pod-tp': '#b57b6b',
  'pod-ss': '#8b6bab',
  'pod-la': '#5ba3a3',
};

export function getPodColor(podId: string): string {
  return POD_COLORS[podId] || '#888';
}

/** Per-pod day totals for a person in a given week */
export interface PodBreakdownEntry {
  podId: string;
  podName: string;
  days: number;
  color: string;
}

export interface PersonWeekPodBreakdown {
  entries: PodBreakdownEntry[];
  topPodId: string | null;
  topPodDays: number;
  totalDays: number;
}

export function getPersonWeekPodBreakdown(
  personId: string,
  weekDates: Set<string>,
  allocations: Allocation[],
  wiPodMap: Record<string, string>,
  pods: Pod[],
): PersonWeekPodBreakdown {
  const podDays: Record<string, number> = {};

  for (const a of allocations) {
    if (a.personId !== personId) continue;
    if (!weekDates.has(a.date)) continue;
    const podId = wiPodMap[a.workItemId];
    if (podId) {
      podDays[podId] = (podDays[podId] || 0) + a.days;
    }
  }

  const entries: PodBreakdownEntry[] = Object.entries(podDays)
    .map(([podId, days]) => ({
      podId,
      podName: getPodPrefix(podId),
      days,
      color: getPodColor(podId),
    }))
    .sort((a, b) => b.days - a.days);

  const topEntry = entries[0] || null;

  return {
    entries,
    topPodId: topEntry?.podId || null,
    topPodDays: topEntry?.days || 0,
    totalDays: entries.reduce((s, e) => s + e.days, 0),
  };
}

/* ---- Cross-pod assignment helpers ---- */

/** Returns true if the allocation's work item belongs to a different pod than the person's home pod */
export function isCrossPodAllocation(
  allocation: Allocation,
  person: Person,
  wiPodMap: Record<string, string>,
): boolean {
  if (!person.homePodId) return false;
  const assignedPodId = wiPodMap[allocation.workItemId];
  if (!assignedPodId) return false;
  return assignedPodId !== person.homePodId;
}

/** Cross-pod breakdown for a person in a given week */
export interface CrossPodBreakdownEntry {
  podId: string;
  podName: string;
  days: number;
  color: string;
}

export interface PersonWeekCrossPodBreakdown {
  entries: CrossPodBreakdownEntry[];
  totalCrossPodDays: number;
}

export function getPersonWeekCrossPodBreakdown(
  personId: string,
  homePodId: string | undefined,
  weekDates: Set<string>,
  allocations: Allocation[],
  wiPodMap: Record<string, string>,
  pods: Pod[],
): PersonWeekCrossPodBreakdown {
  if (!homePodId) return { entries: [], totalCrossPodDays: 0 };

  const podDays: Record<string, number> = {};

  for (const a of allocations) {
    if (a.personId !== personId) continue;
    if (!weekDates.has(a.date)) continue;
    const assignedPodId = wiPodMap[a.workItemId];
    if (!assignedPodId || assignedPodId === homePodId) continue;
    podDays[assignedPodId] = (podDays[assignedPodId] || 0) + a.days;
  }

  const entries: CrossPodBreakdownEntry[] = Object.entries(podDays)
    .map(([podId, days]) => ({
      podId,
      podName: getPodPrefix(podId),
      days,
      color: getPodColor(podId),
    }))
    .sort((a, b) => b.days - a.days);

  return {
    entries,
    totalCrossPodDays: entries.reduce((s, e) => s + e.days, 0),
  };
}
