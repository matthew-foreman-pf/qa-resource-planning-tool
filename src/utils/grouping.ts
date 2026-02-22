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
 *
 * Grouping rules:
 * 1. Emily (QA Lead) gets her own top-level group.
 * 2. Each pod lead gets a group containing their pod(s).
 * 3. Testers with a homePodId are placed in that pod's subgroup.
 * 4. Testers with NO homePodId but with a leadId are placed in a
 *    "No Pod" subgroup under their lead's group.
 * 5. Testers with NO homePodId and NO leadId go into
 *    "Unassigned (Needs Owner)" at the bottom.
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
  const testers = people.filter((p) => p.role === 'tester');

  // Map podId -> leadId (from LEAD_POD_MAP)
  const podToLead = new Map<string, string>();
  for (const [leadId, podIds] of Object.entries(LEAD_POD_MAP)) {
    for (const pid of podIds) {
      podToLead.set(pid, leadId);
    }
  }

  // Track placed tester IDs
  const placedTesterIds = new Set<string>();

  // Separate testers into three buckets:
  // a) Has homePodId → goes to that pod's subgroup
  // b) No homePodId but has leadId → goes to "No Pod" subgroup under lead
  // c) No homePodId and no leadId → "Unassigned"

  const groups: PodGroup[] = [];

  // --- Emily group first ---
  if (qaLead) {
    // Collect no-pod testers assigned to Emily via leadId
    const emilyNoPodTesters = testers.filter(
      (t) => !t.homePodId && t.leadId === qaLead.id
    );
    for (const t of emilyNoPodTesters) placedTesterIds.add(t.id);

    const subgroups: PodSubgroup[] = [
      {
        pod: { id: '__qa_lead__', name: 'QA Lead' },
        people: [qaLead],
      },
    ];

    if (emilyNoPodTesters.length > 0) {
      subgroups.push({
        pod: { id: '__no_pod_emily__', name: 'No Pod' },
        people: emilyNoPodTesters,
      });
    }

    groups.push({
      lead: qaLead,
      label: `QA Lead: ${qaLead.name}`,
      pods: subgroups,
    });
  }

  // --- Pod lead groups ---
  for (const lead of leads) {
    const podIds = LEAD_POD_MAP[lead.id] || (lead.homePodId ? [lead.homePodId] : []);
    if (podIds.length === 0) continue;

    const podNames = podIds.map((pid) => podMap.get(pid)?.name || pid).join(' + ');
    const label = `${podNames} (Lead: ${lead.name})`;

    const subgroups: PodSubgroup[] = [];

    for (const podId of podIds) {
      const pod = podMap.get(podId);
      if (!pod) continue;

      // Testers whose homePodId matches this pod
      const podTesters = testers.filter((t) => t.homePodId === podId);
      for (const t of podTesters) placedTesterIds.add(t.id);

      const podPeople: Person[] = [];
      // Lead goes in first subgroup only
      if (podIds.indexOf(podId) === 0) {
        podPeople.push(lead);
      }
      podPeople.push(...podTesters);

      subgroups.push({ pod, people: podPeople });
    }

    // No-pod testers assigned to this lead via leadId
    const noPodTesters = testers.filter(
      (t) => !t.homePodId && t.leadId === lead.id
    );
    for (const t of noPodTesters) placedTesterIds.add(t.id);

    if (noPodTesters.length > 0) {
      subgroups.push({
        pod: { id: `__no_pod_${lead.id}__`, name: 'No Pod' },
        people: noPodTesters,
      });
    }

    groups.push({ lead, label, pods: subgroups });
  }

  // --- Unassigned (Needs Owner) ---
  const unassigned = testers.filter((t) => !placedTesterIds.has(t.id));
  if (unassigned.length > 0) {
    groups.push({
      lead: null,
      label: 'Unassigned (Needs Owner)',
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
