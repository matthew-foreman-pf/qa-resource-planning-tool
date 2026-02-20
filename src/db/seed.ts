import type {
  Pod,
  Person,
  WorkItem,
  Allocation,
  TimeOff,
  Scenario,
} from '../types';
import { addWeeks, addDays, format } from 'date-fns';
import { today, toDateStr, getWeekdaysInRange, getWeekStart } from '../utils/dates';

function makeId(): string {
  return crypto.randomUUID();
}

// ---- Pods ----
export const seedPods: Pod[] = [
  { id: 'pod-ww', name: 'Word Wizards' },
  { id: 'pod-ps', name: 'Pod Squad' },
  { id: 'pod-tp', name: 'TINPOZ' },
  { id: 'pod-ss', name: 'ServerScapes' },
  { id: 'pod-la', name: 'Lalo' },
];

const podPrefixes: Record<string, string> = {
  'pod-ww': 'WW',
  'pod-ps': 'PS',
  'pod-tp': 'TP',
  'pod-ss': 'SS',
  'pod-la': 'LA',
};

// ---- People ----
export const seedPeople: Person[] = [
  {
    id: 'person-emily',
    name: 'Emily',
    role: 'qa_lead',
    type: 'internal',
    weeklyCapacityDays: 5,
    weeklyBufferPct: 0.1,
  },
  {
    id: 'person-izzy',
    name: 'Izzy',
    role: 'pod_lead',
    homePodId: 'pod-ps',
    type: 'internal',
    weeklyCapacityDays: 5,
    weeklyBufferPct: 0.1,
  },
  {
    id: 'person-lionel',
    name: 'Lionel',
    role: 'pod_lead',
    homePodId: 'pod-la',
    type: 'internal',
    weeklyCapacityDays: 5,
    weeklyBufferPct: 0.1,
  },
  {
    id: 'person-kawika',
    name: 'Kawika',
    role: 'pod_lead',
    homePodId: 'pod-tp',
    type: 'internal',
    weeklyCapacityDays: 5,
    weeklyBufferPct: 0.1,
  },
  {
    id: 'person-tbh',
    name: 'TBH',
    role: 'pod_lead',
    homePodId: 'pod-ww',
    type: 'internal',
    weeklyCapacityDays: 5,
    weeklyBufferPct: 0.1,
  },
];

// 25 vendor testers
for (let i = 1; i <= 25; i++) {
  const num = String(i).padStart(2, '0');
  seedPeople.push({
    id: `person-vendor-${num}`,
    name: `Vendor QA ${num}`,
    role: 'tester',
    type: 'vendor',
    weeklyCapacityDays: 5,
    weeklyBufferPct: 0.1,
  });
}

// ---- Work Items ----
const t = today();
const ws = getWeekStart(t);

export function generateSeedWorkItems(): WorkItem[] {
  return [
    // Word Wizards (3 items)
    {
      id: 'wi-ww-1',
      type: 'feature',
      name: 'Spell Check Overhaul',
      podId: 'pod-ww',
      startDate: toDateStr(ws),
      endDate: toDateStr(addWeeks(ws, 6)),
      requiredMinDaysPerWeek: 3,
    },
    {
      id: 'wi-ww-2',
      type: 'feature',
      name: 'Grammar Engine v2',
      podId: 'pod-ww',
      startDate: toDateStr(addWeeks(ws, 4)),
      endDate: toDateStr(addWeeks(ws, 10)),
      requiredMinDaysPerWeek: 2,
    },
    {
      id: 'wi-ww-3',
      type: 'initiative',
      name: 'Localization Testing',
      podId: 'pod-ww',
      startDate: toDateStr(addWeeks(ws, 1)),
      endDate: toDateStr(addWeeks(ws, 8)),
      requiredMinDaysPerWeek: 2,
      notes: 'Covers 12 languages',
    },

    // Pod Squad (3 items)
    {
      id: 'wi-ps-1',
      type: 'feature',
      name: 'Dashboard Redesign',
      podId: 'pod-ps',
      startDate: toDateStr(ws),
      endDate: toDateStr(addWeeks(ws, 5)),
      requiredMinDaysPerWeek: 4,
      releaseDate: toDateStr(addWeeks(ws, 5)),
    },
    {
      id: 'wi-ps-2',
      type: 'feature',
      name: 'User Profile Revamp',
      podId: 'pod-ps',
      startDate: toDateStr(addWeeks(ws, 3)),
      endDate: toDateStr(addWeeks(ws, 9)),
      requiredMinDaysPerWeek: 2,
    },
    {
      id: 'wi-ps-3',
      type: 'initiative',
      name: 'Accessibility Audit',
      podId: 'pod-ps',
      startDate: toDateStr(addWeeks(ws, 6)),
      endDate: toDateStr(addWeeks(ws, 11)),
      requiredMinDaysPerWeek: 3,
    },

    // TINPOZ (2 items)
    {
      id: 'wi-tp-1',
      type: 'feature',
      name: 'Notification System',
      podId: 'pod-tp',
      startDate: toDateStr(ws),
      endDate: toDateStr(addWeeks(ws, 7)),
      requiredMinDaysPerWeek: 3,
    },
    {
      id: 'wi-tp-2',
      type: 'feature',
      name: 'Push Integration',
      podId: 'pod-tp',
      startDate: toDateStr(addWeeks(ws, 5)),
      endDate: toDateStr(addWeeks(ws, 11)),
      requiredMinDaysPerWeek: 2,
    },

    // ServerScapes (4 items - intentionally overlapping for risk)
    {
      id: 'wi-ss-1',
      type: 'feature',
      name: 'Login Migration',
      podId: 'pod-ss',
      startDate: toDateStr(ws),
      endDate: toDateStr(addWeeks(ws, 4)),
      requiredMinDaysPerWeek: 5,
      releaseDate: toDateStr(addWeeks(ws, 4)),
      notes: 'Critical path - high priority',
    },
    {
      id: 'wi-ss-2',
      type: 'feature',
      name: 'API Gateway Upgrade',
      podId: 'pod-ss',
      startDate: toDateStr(addWeeks(ws, 1)),
      endDate: toDateStr(addWeeks(ws, 8)),
      requiredMinDaysPerWeek: 3,
    },
    {
      id: 'wi-ss-3',
      type: 'initiative',
      name: 'Load Testing Suite',
      podId: 'pod-ss',
      startDate: toDateStr(addWeeks(ws, 2)),
      endDate: toDateStr(addWeeks(ws, 10)),
      requiredMinDaysPerWeek: 2,
    },
    {
      id: 'wi-ss-4',
      type: 'feature',
      name: 'Database Sharding QA',
      podId: 'pod-ss',
      startDate: toDateStr(ws),
      endDate: toDateStr(addWeeks(ws, 6)),
      requiredMinDaysPerWeek: 3,
      notes: 'Overlaps with Login Migration',
    },

    // Lalo (2 items)
    {
      id: 'wi-la-1',
      type: 'feature',
      name: 'Payment Flow v3',
      podId: 'pod-la',
      startDate: toDateStr(ws),
      endDate: toDateStr(addWeeks(ws, 8)),
      requiredMinDaysPerWeek: 3,
      releaseDate: toDateStr(addWeeks(ws, 9)),
    },
    {
      id: 'wi-la-2',
      type: 'initiative',
      name: 'Fraud Detection Tests',
      podId: 'pod-la',
      startDate: toDateStr(addWeeks(ws, 3)),
      endDate: toDateStr(addWeeks(ws, 11)),
      requiredMinDaysPerWeek: 2,
    },
  ];
}

export function generateSeedAllocations(workItems: WorkItem[]): Allocation[] {
  const allocations: Allocation[] = [];
  const personWorkItemCount: Record<string, Set<string>> = {};

  function addAlloc(personId: string, workItemId: string, date: string) {
    allocations.push({
      id: makeId(),
      personId,
      workItemId,
      date,
      days: 1,
    });
    if (!personWorkItemCount[personId]) {
      personWorkItemCount[personId] = new Set();
    }
    personWorkItemCount[personId].add(workItemId);
  }

  // Helper: get weekdays within a work item's range
  function getWIDays(wi: WorkItem): string[] {
    return getWeekdaysInRange(
      new Date(wi.startDate),
      new Date(wi.endDate)
    ).map(toDateStr);
  }

  const wiMap: Record<string, WorkItem> = {};
  for (const wi of workItems) {
    wiMap[wi.id] = wi;
  }

  // ---- Assign leads to their pod's work items ----
  // Emily helps across pods (mainly SS which is overloaded)
  const ssLogin = wiMap['wi-ss-1'];
  const ssApi = wiMap['wi-ss-2'];
  const ssLoad = wiMap['wi-ss-3'];
  const ssDb = wiMap['wi-ss-4'];

  // Kawika on TINPOZ + ServerScapes
  const tpNotif = wiMap['wi-tp-1'];
  const tpPush = wiMap['wi-tp-2'];

  // Assign Kawika: 3 days/week on Notification, then split
  {
    const days = getWIDays(tpNotif);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc('person-kawika', 'wi-tp-1', d);
      count++;
    }
  }
  {
    const days = getWIDays(ssLogin);
    let count = 0;
    for (const d of days) {
      if (count % 5 >= 3) addAlloc('person-kawika', 'wi-ss-1', d);
      count++;
    }
  }

  // Emily: split across SS items (overloaded to create risk)
  {
    const days = getWIDays(ssLogin);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 2) addAlloc('person-emily', 'wi-ss-1', d);
      count++;
    }
  }
  {
    const days = getWIDays(ssDb);
    let count = 0;
    for (const d of days) {
      if (count % 5 >= 2 && count % 5 < 4) addAlloc('person-emily', 'wi-ss-4', d);
      count++;
    }
  }
  {
    const days = getWIDays(ssApi);
    let count = 0;
    for (const d of days) {
      if (count % 5 === 4) addAlloc('person-emily', 'wi-ss-2', d);
      count++;
    }
  }

  // Izzy on Pod Squad items
  {
    const days = getWIDays(wiMap['wi-ps-1']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc('person-izzy', 'wi-ps-1', d);
      count++;
    }
  }
  {
    const days = getWIDays(wiMap['wi-ps-2']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 2) addAlloc('person-izzy', 'wi-ps-2', d);
      count++;
    }
  }

  // Lionel on Lalo items
  {
    const days = getWIDays(wiMap['wi-la-1']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc('person-lionel', 'wi-la-1', d);
      count++;
    }
  }
  {
    const days = getWIDays(wiMap['wi-la-2']);
    let count = 0;
    for (const d of days) {
      if (count % 5 >= 3 && count % 5 < 5) addAlloc('person-lionel', 'wi-la-2', d);
      count++;
    }
  }

  // TBH on Word Wizards
  {
    const days = getWIDays(wiMap['wi-ww-1']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 2) addAlloc('person-tbh', 'wi-ww-1', d);
      count++;
    }
  }
  {
    const days = getWIDays(wiMap['wi-ww-3']);
    let count = 0;
    for (const d of days) {
      if (count % 5 >= 2 && count % 5 < 4) addAlloc('person-tbh', 'wi-ww-3', d);
      count++;
    }
  }

  // ---- Vendor tester assignments ----
  // Distribute vendors across work items to achieve ~70-80% capacity
  // Also create context switching risk for a few vendors

  // Vendors 01-04: SS Login Migration (heavy staffing)
  for (let v = 1; v <= 4; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(ssLogin);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 4) addAlloc(vid, 'wi-ss-1', d);
      count++;
    }
  }

  // Vendors 05-06: SS Database Sharding
  for (let v = 5; v <= 6; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(ssDb);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-ss-4', d);
      count++;
    }
  }

  // Vendors 07-08: SS API Gateway
  for (let v = 7; v <= 8; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(ssApi);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-ss-2', d);
      count++;
    }
  }

  // Vendor 09: SS Load Testing
  {
    const vid = 'person-vendor-09';
    const days = getWIDays(ssLoad);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-ss-3', d);
      count++;
    }
  }

  // Vendors 10-12: Pod Squad Dashboard
  for (let v = 10; v <= 12; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(wiMap['wi-ps-1']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-ps-1', d);
      count++;
    }
  }

  // Vendors 13-14: Pod Squad User Profile
  for (let v = 13; v <= 14; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(wiMap['wi-ps-2']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-ps-2', d);
      count++;
    }
  }

  // Vendors 15-16: TINPOZ Notification System
  for (let v = 15; v <= 16; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(tpNotif);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-tp-1', d);
      count++;
    }
  }

  // Vendor 17: TINPOZ Push Integration
  {
    const vid = 'person-vendor-17';
    const days = getWIDays(tpPush);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-tp-2', d);
      count++;
    }
  }

  // Vendors 18-20: Word Wizards Spell Check
  for (let v = 18; v <= 20; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(wiMap['wi-ww-1']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-ww-1', d);
      count++;
    }
  }

  // Vendors 21-22: Lalo Payment Flow
  for (let v = 21; v <= 22; v++) {
    const vid = `person-vendor-${String(v).padStart(2, '0')}`;
    const days = getWIDays(wiMap['wi-la-1']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 3) addAlloc(vid, 'wi-la-1', d);
      count++;
    }
  }

  // Vendor 23: Lalo Fraud Detection
  {
    const vid = 'person-vendor-23';
    const days = getWIDays(wiMap['wi-la-2']);
    let count = 0;
    for (const d of days) {
      if (count % 5 < 2) addAlloc(vid, 'wi-la-2', d);
      count++;
    }
  }

  // Vendors 24-25: Context switching overload - assigned to many items
  // Vendor 24 gets spread across 5 different work items (context switching risk)
  {
    const vid = 'person-vendor-24';
    const items = ['wi-ss-1', 'wi-ss-2', 'wi-ss-4', 'wi-tp-1', 'wi-ps-1'];
    for (const wiId of items) {
      const wi = wiMap[wiId];
      if (!wi) continue;
      const days = getWIDays(wi);
      // Assign 1 day per week per item
      let weekCount = 0;
      for (let i = 0; i < days.length; i++) {
        const dayOfWeek = i % 5;
        if (dayOfWeek === items.indexOf(wiId)) {
          addAlloc(vid, wiId, days[i]);
        }
      }
    }
  }

  // Vendor 25: Also spread thin - 6 items (red context switching risk)
  {
    const vid = 'person-vendor-25';
    const items = ['wi-ss-1', 'wi-ss-2', 'wi-ss-3', 'wi-ss-4', 'wi-tp-1', 'wi-la-1'];
    for (const wiId of items) {
      const wi = wiMap[wiId];
      if (!wi) continue;
      const days = getWIDays(wi);
      for (let i = 0; i < days.length; i++) {
        const dayOfWeek = i % 6;
        if (dayOfWeek === items.indexOf(wiId) && i % 5 < 5) {
          addAlloc(vid, wiId, days[i]);
        }
      }
    }
  }

  // Intentionally leave WW Grammar Engine v2 and PS Accessibility Audit under-staffed
  // (no vendor allocations) to create coverage risk

  return allocations;
}

export function generateSeedTimeOffs(): TimeOff[] {
  const timeOffs: TimeOff[] = [];
  // Give a few people time off to create capacity gaps
  const w2Mon = addWeeks(ws, 1);
  const w2Days = getWeekdaysInRange(w2Mon, addDays(w2Mon, 4));

  // Kawika out for 2 days in week 2
  if (w2Days.length >= 2) {
    timeOffs.push({
      id: makeId(),
      personId: 'person-kawika',
      date: toDateStr(w2Days[0]),
      reason: 'Conference',
    });
    timeOffs.push({
      id: makeId(),
      personId: 'person-kawika',
      date: toDateStr(w2Days[1]),
      reason: 'Conference',
    });
  }

  // Vendor 01 out for a day in week 1
  const w1Days = getWeekdaysInRange(ws, addDays(ws, 4));
  if (w1Days.length >= 3) {
    timeOffs.push({
      id: makeId(),
      personId: 'person-vendor-01',
      date: toDateStr(w1Days[2]),
      reason: 'Personal day',
    });
  }

  return timeOffs;
}

export const basePlanScenario: Scenario = {
  id: 'scenario-base',
  name: 'Base Plan',
  isBase: true,
};
