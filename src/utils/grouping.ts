import type { Person, Pod, PodGroup, PodSubgroup, Allocation, WorkItem, RiskLevel } from '../types';
import type { WeekInfo } from './dates';
import { toDateStr } from './dates';

/**
 * Lead-to-pod mapping. Kawika owns both TINPOZ and ServerScapes.
 */
const LEAD_POD_MAP: Record<string, string[]> = {
  'person-tbh': ['pod-ww'],
  'person-izzy': ['pod-ps'],
  'person-lionel': ['pod-la'],
  'person-kawika': ['pod-tp', 'pod-ss'],
};

/**
 * Build pod groups for the roster.
 * Emily (QA Lead) gets her own group at the top.
 * Each pod lead gets a group containing their pod(s).
 * Testers are assigned to groups based on their allocations.
 */
export function buildPodGroups(
  people: Person[],
  pods: Pod[],
  allocations: Allocation[],
  workItems: WorkItem[],
): PodGroup[] {
  const podMap = new Map(pods.map((p) => [p.id, p]));
  const leads = people.filter((p) => p.role === 'pod_lead');
  const qaLead = people.find((p) => p.role === 'qa_lead');

  // Build workItem -> podId map
  const wiPodMap = new Map(workItems.map((wi) => [wi.id, wi.podId]));

  // Figure out which pod each tester is most associated with (by allocation count)
  const testerPodAffinity = new Map<string, string>();
  const testers = people.filter((p) => p.role === 'tester');
  for (const tester of testers) {
    const podCounts: Record<string, number> = {};
    for (const a of allocations) {
      if (a.personId !== tester.id) continue;
      const podId = wiPodMap.get(a.workItemId);
      if (podId) {
        podCounts[podId] = (podCounts[podId] || 0) + 1;
      }
    }
    // Pick pod with most allocations
    let bestPod = '';
    let bestCount = 0;
    for (const [podId, count] of Object.entries(podCounts)) {
      if (count > bestCount) {
        bestPod = podId;
        bestCount = count;
      }
    }
    if (bestPod) {
      testerPodAffinity.set(tester.id, bestPod);
    }
  }

  // Map podId -> leadId
  const podToLead = new Map<string, string>();
  for (const [leadId, podIds] of Object.entries(LEAD_POD_MAP)) {
    for (const pid of podIds) {
      podToLead.set(pid, leadId);
    }
  }

  const groups: PodGroup[] = [];

  // Emily group first
  if (qaLead) {
    groups.push({
      lead: qaLead,
      label: `QA Lead: ${qaLead.name}`,
      pods: [{
        pod: { id: '__qa_lead__', name: 'QA Lead' },
        people: [qaLead],
      }],
    });
  }

  // Pod lead groups
  for (const lead of leads) {
    const podIds = LEAD_POD_MAP[lead.id] || (lead.homePodId ? [lead.homePodId] : []);
    if (podIds.length === 0) continue;

    const podNames = podIds.map((pid) => podMap.get(pid)?.name || pid).join(' + ');
    const label = `${podNames} (Lead: ${lead.name})`;

    const subgroups: PodSubgroup[] = [];
    for (const podId of podIds) {
      const pod = podMap.get(podId);
      if (!pod) continue;

      // Get testers assigned to this pod
      const podTesters = testers.filter(
        (t) => testerPodAffinity.get(t.id) === podId
      );

      // Lead goes in first subgroup only
      const podPeople: Person[] = [];
      if (podIds.indexOf(podId) === 0) {
        podPeople.push(lead);
      }
      podPeople.push(...podTesters);

      subgroups.push({ pod, people: podPeople });
    }

    groups.push({ lead, label, pods: subgroups });
  }

  // Unassigned testers (no allocations at all)
  const assignedTesterIds = new Set<string>();
  for (const g of groups) {
    for (const sg of g.pods) {
      for (const p of sg.people) {
        assignedTesterIds.add(p.id);
      }
    }
  }
  const unassigned = testers.filter((t) => !assignedTesterIds.has(t.id));
  if (unassigned.length > 0) {
    groups.push({
      lead: null,
      label: 'Unassigned',
      pods: [{
        pod: { id: '__unassigned__', name: 'Unassigned' },
        people: unassigned,
      }],
    });
  }

  return groups;
}

/**
 * Compute group-level weekly summary for the group header.
 */
export interface GroupWeeklySummary {
  assignedDays: number;
  totalCapDays: number;
  redCount: number;
  yellowCount: number;
}

export function computeGroupWeeklySummary(
  group: PodGroup,
  allocations: Allocation[],
  workItems: WorkItem[],
  currentWeek: WeekInfo,
): GroupWeeklySummary {
  const weekDays = currentWeek.weekdays.map(toDateStr);

  // All people IDs in this group
  const personIds = new Set<string>();
  for (const sg of group.pods) {
    for (const p of sg.people) {
      personIds.add(p.id);
    }
  }

  // Assigned days for people in this group this week
  const assignedDays = allocations
    .filter((a) => personIds.has(a.personId) && weekDays.includes(a.date))
    .reduce((sum, a) => sum + a.days, 0);

  // Total cap for people in this group
  let totalCapDays = 0;
  for (const sg of group.pods) {
    for (const p of sg.people) {
      if (p.status === 'active') {
        totalCapDays += p.weeklyCapacityDays;
      }
    }
  }

  // Pod IDs in this group
  const podIds = new Set(
    group.pods.map((sg) => sg.pod.id).filter((id) => !id.startsWith('__'))
  );

  // Work items belonging to these pods
  const groupWIs = workItems.filter((wi) => podIds.has(wi.podId));

  // Coverage risk per work item for this week
  let redCount = 0;
  let yellowCount = 0;
  for (const wi of groupWIs) {
    const overlapDays = weekDays.filter((d) => d >= wi.startDate && d <= wi.endDate);
    if (overlapDays.length === 0) continue;

    const planned = allocations
      .filter((a) => a.workItemId === wi.id && overlapDays.includes(a.date))
      .reduce((sum, a) => sum + a.days, 0);

    const required = wi.requiredMinDaysPerWeek;
    if (planned < 0.6 * required) {
      redCount++;
    } else if (planned < required) {
      yellowCount++;
    }
  }

  return { assignedDays, totalCapDays, redCount, yellowCount };
}
