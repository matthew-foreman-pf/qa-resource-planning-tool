import { create } from 'zustand';
import { db, isCloudEnabled } from '../db';
import type {
  Pod,
  Person,
  WorkItem,
  Allocation,
  TimeOff,
  Scenario,
  AppData,
} from '../types';
import {
  seedPods,
  seedPeople,
  generateSeedWorkItems,
  generateSeedAllocations,
  generateSeedTimeOffs,
  basePlanScenario,
  TEAM_REALM_ID,
  TEAM_EMAILS,
} from '../db/seed';
import { toDateStr, today, getWeekdaysInRangeStr, getWeekStart } from '../utils/dates';

/** Returns realm props to spread onto objects when in cloud mode */
function cloudProps(): Record<string, string> {
  if (!isCloudEnabled) return {};
  return { realmId: TEAM_REALM_ID };
}

/** Seed the database with initial demo data */
async function seedDatabase() {
  const cp = cloudProps();
  await db.pods.bulkPut(seedPods.map((p) => ({ ...p, ...cp })));
  await db.people.bulkPut(seedPeople.map((p) => ({ ...p, ...cp })));
  await db.scenarios.put({ ...basePlanScenario, ...cp });

  const workItems = generateSeedWorkItems();
  await db.workItems.bulkPut(
    workItems.map((wi) => ({ ...wi, scenarioId: 'scenario-base', ...cp }))
  );

  const allocations = generateSeedAllocations(workItems);
  await db.allocations.bulkPut(
    allocations.map((a) => ({ ...a, scenarioId: 'scenario-base', ...cp }))
  );

  const timeOffs = generateSeedTimeOffs();
  await db.timeOffs.bulkPut(
    timeOffs.map((to) => ({ ...to, scenarioId: 'scenario-base', ...cp }))
  );
}

/**
 * Wait for Dexie Cloud initial sync to complete before making seeding decisions.
 * Returns true if sync completed successfully, false on error/timeout.
 */
function waitForSync(timeoutMs = 15000): Promise<boolean> {
  if (!isCloudEnabled) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub?.unsubscribe();
      resolve(false); // timed out — don't seed to avoid overwriting server data
    }, timeoutMs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = (db as any).cloud.syncState.subscribe((state: any) => {
      if (state?.phase === 'in-sync') {
        clearTimeout(timer);
        sub.unsubscribe();
        resolve(true);
      } else if (state?.phase === 'error') {
        clearTimeout(timer);
        sub.unsubscribe();
        resolve(false);
      }
    });
  });
}

/**
 * Subscribe to Dexie Cloud sync state and refresh Zustand state when sync
 * brings new data. This ensures the UI always reflects the latest DB state,
 * even when cloud sync updates data after the initial load.
 */
let syncListenerActive = false;
function setupSyncListener() {
  if (syncListenerActive || !isCloudEnabled) return;
  syncListenerActive = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).cloud.syncState.subscribe((state: any) => {
    if (state?.phase === 'in-sync') {
      // Refresh global data
      Promise.all([
        db.pods.toArray(),
        db.people.toArray(),
        db.scenarios.toArray(),
      ]).then(([pods, people, scenarios]) => {
        useStore.setState({ pods, people, scenarios });
      });
      // Refresh scenario-specific data
      const { currentScenarioId } = useStore.getState();
      useStore.getState().loadScenarioData(currentScenarioId);
    }
  });
}

interface AppState {
  // Data
  pods: Pod[];
  people: Person[];
  scenarios: Scenario[];
  currentScenarioId: string;
  workItems: WorkItem[];
  allocations: Allocation[];
  timeOffs: TimeOff[];

  // UI state
  currentScreen: 'roster' | 'dashboard' | 'editPlan' | 'workItems' | 'people' | 'settings';
  selectedCellInfo: {
    personId: string;
    date: string;
  } | null;
  dayDrawerOpen: boolean;
  selectedPersonId: string | null;
  personDrawerOpen: boolean;
  showArchivedPeople: boolean;
  podFilterIds: string[]; // empty = all pods
  currentUserId: string | null;

  // Add person drawer
  addPersonDrawerOpen: boolean;

  // Edit mode (multi-select + drag)
  editMode: boolean;
  selectedCells: Set<string>; // "personId|date" keys
  selectionPersonId: string | null; // locks drag to one person row
  isSelecting: boolean; // pointer is down and dragging

  // Active week for pod breakdown chips
  activeWeekStartDate: string; // YYYY-MM-DD (Monday)

  // Actions
  initialize: () => Promise<void>;
  setScreen: (screen: AppState['currentScreen']) => void;
  setScenario: (scenarioId: string) => void;
  loadScenarioData: (scenarioId: string) => Promise<void>;

  // Cell / Day drawer selection
  selectCell: (personId: string, date: string) => void;
  closeDayDrawer: () => void;

  // Person drawer
  openPersonDrawer: (personId: string) => void;
  closePersonDrawer: () => void;

  // Person CRUD
  addPerson: (person: Person) => Promise<void>;
  updatePerson: (person: Person) => Promise<void>;
  archivePerson: (personId: string) => Promise<void>;
  restorePerson: (personId: string) => Promise<void>;

  // Add person drawer
  openAddPersonDrawer: () => void;
  closeAddPersonDrawer: () => void;

  // Work item CRUD
  addWorkItem: (wi: WorkItem) => Promise<void>;
  updateWorkItem: (wi: WorkItem) => Promise<void>;
  deleteWorkItem: (id: string) => Promise<void>;

  // Allocation CRUD
  addAllocations: (allocs: Allocation[]) => Promise<void>;
  removeAllocation: (id: string) => Promise<void>;
  setAllocationForDay: (personId: string, date: string, workItemId: string) => Promise<void>;
  setAllocationForRange: (personId: string, workItemId: string, startDate: string, endDate: string, weekdaysOnly: boolean) => Promise<void>;
  clearAllocations: (personId: string, startDate: string, endDate: string) => Promise<void>;
  copyWeekAllocations: (personId: string, sourceWeekStart: string, targetWeekStart: string) => Promise<void>;

  // Bulk unassign / reassign
  deleteAllocationsByIds: (ids: string[]) => Promise<void>;
  bulkReassign: (
    updateIds: string[],
    newWorkItemId: string,
    deleteConflictIds: string[],
  ) => Promise<void>;

  // Bulk home pod update
  batchUpdatePeopleHomePod: (
    personIds: string[],
    destinationPodId: string,
    updatePodLeadDefaultFilter: boolean,
  ) => Promise<void>;

  // Bulk lead assignment
  batchUpdatePeopleLead: (
    personIds: string[],
    leadId: string,
  ) => Promise<void>;

  // Time off
  addTimeOff: (to: TimeOff) => Promise<void>;
  removeTimeOff: (id: string) => Promise<void>;
  addTimeOffForRange: (personId: string, startDate: string, endDate: string, weekdaysOnly: boolean, reason?: string) => Promise<number>;
  removeTimeOffsForRange: (personId: string, startDate: string, endDate: string) => Promise<number>;

  // Scenario management
  duplicateScenario: (sourceId: string, newName: string) => Promise<string>;

  // Edit mode (multi-select + drag)
  setEditMode: (on: boolean) => void;
  toggleCellSelection: (personId: string, date: string) => void;
  startDragSelection: (personId: string, date: string) => void;
  extendDragSelection: (personId: string, date: string) => void;
  endDragSelection: () => void;
  clearSelection: () => void;
  batchAssign: (workItemId: string, mode?: 'replace' | 'skip') => Promise<void>;
  batchClear: () => Promise<void>;

  // UI toggles
  setShowArchivedPeople: (show: boolean) => void;
  setPodFilterIds: (ids: string[]) => void;
  setActiveWeekStartDate: (date: string) => void;

  // Import/Export
  exportData: () => Promise<AppData>;
  importData: (data: AppData) => Promise<void>;

  // Reset
  resetData: () => Promise<void>;

  // Cloud
  inviteTeamMember: (email: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  pods: [],
  people: [],
  scenarios: [],
  currentScenarioId: 'scenario-base',
  workItems: [],
  allocations: [],
  timeOffs: [],
  currentScreen: 'roster',
  selectedCellInfo: null,
  dayDrawerOpen: false,
  selectedPersonId: null,
  personDrawerOpen: false,
  showArchivedPeople: false,
  podFilterIds: [],
  currentUserId: null,
  addPersonDrawerOpen: false,
  editMode: false,
  selectedCells: new Set<string>(),
  selectionPersonId: null,
  isSelecting: false,
  activeWeekStartDate: toDateStr(getWeekStart(today())),

  initialize: async () => {
    if (isCloudEnabled) {
      // Wait for Dexie Cloud initial sync to complete before making seeding
      // decisions. Without this, a fresh session (empty local DB) would see
      // scenarioCount === 0 and re-seed, overwriting the user's real data
      // on the cloud server.
      const syncOk = await waitForSync();

      const existingRealm = await db.table('realms').get(TEAM_REALM_ID);
      const scenarioCount = await db.scenarios.count();

      // Create realm if it doesn't exist
      if (!existingRealm) {
        await db.table('realms').put({
          realmId: TEAM_REALM_ID,
          name: 'QA Team Planning',
          owner: db.cloud.currentUserId,
        });

        await db.table('members').add({
          realmId: TEAM_REALM_ID,
          userId: db.cloud.currentUserId,
          name: 'Admin',
          roles: ['admin'],
          accepted: new Date(),
        });
      }

      // Only the realm owner should manage roles & invites to avoid
      // rejected mutations from non-owner users poisoning the sync.
      const isRealmOwner = existingRealm
        ? existingRealm.owner === db.cloud.currentUserId
        : true; // we just created it above

      if (isRealmOwner) {
        // Add realm roles so all members can read/write.
        // Use string '*' wildcards — array ['*'] is NOT a wildcard in
        // Dexie Cloud's PermissionChecker; it matches only a table
        // literally named '*'.
        try {
          await db.table('roles').bulkPut([
            {
              realmId: TEAM_REALM_ID,
              name: 'admin',
              permissions: {
                add: '*',
                update: '*',
                manage: '*',
              },
            },
            {
              realmId: TEAM_REALM_ID,
              name: 'editor',
              permissions: {
                add: '*',
                update: '*',
                manage: '*',
              },
            },
          ]);
        } catch {
          // roles may already exist
        }

        // Auto-invite team members who aren't yet invited
        const members = await db.table('members').toArray();
        const invitedEmails = new Set(
          members
            .filter((m: any) => m.realmId === TEAM_REALM_ID)
            .map((m: any) => m.email?.toLowerCase())
            .filter(Boolean)
        );
        const missingEmails = TEAM_EMAILS.filter(
          (e) => !invitedEmails.has(e.toLowerCase())
        );
        for (const email of missingEmails) {
          try {
            await db.table('members').add({
              realmId: TEAM_REALM_ID,
              email,
              invite: true,
              roles: ['editor'],
            });
          } catch {
            // ignore duplicates
          }
        }
      }

      // Only seed if sync confirmed there is truly no data on the server.
      // If sync failed/timed out, skip seeding to avoid overwriting server data.
      if (scenarioCount === 0 && syncOk) {
        await seedDatabase();
      }

      // Subscribe to future sync completions to refresh UI reactively
      setupSyncListener();
    } else {
      // Local-only mode: seed exactly as before
      const scenarioCount = await db.scenarios.count();
      if (scenarioCount === 0) {
        await seedDatabase();
      }
    }

    const pods = await db.pods.toArray();
    const people = await db.people.toArray();
    const scenarios = await db.scenarios.toArray();

    // Determine current user
    const currentUserId = isCloudEnabled
      ? db.cloud.currentUserId
      : 'person-emily';

    const currentUser = people.find((p) => p.id === currentUserId);

    // Default pod filter based on current user role
    let podFilterIds: string[] = [];
    if (currentUser?.role === 'pod_lead' && currentUser.defaultPodFilterIds?.length) {
      podFilterIds = currentUser.defaultPodFilterIds;
    }

    set({ pods, people, scenarios, currentUserId, podFilterIds });
    await get().loadScenarioData('scenario-base');
  },

  setScreen: (screen) => set({ currentScreen: screen }),

  setScenario: (scenarioId) => {
    set({ currentScenarioId: scenarioId });
    get().loadScenarioData(scenarioId);
  },

  loadScenarioData: async (scenarioId) => {
    const workItems = (
      await db.workItems.where('scenarioId').equals(scenarioId).toArray()
    ).map(({ scenarioId: _, ...wi }) => wi);

    const allocations = (
      await db.allocations.where('scenarioId').equals(scenarioId).toArray()
    ).map(({ scenarioId: _, ...a }) => a);

    const timeOffs = (
      await db.timeOffs.where('scenarioId').equals(scenarioId).toArray()
    ).map(({ scenarioId: _, ...to }) => to);

    set({ workItems, allocations, timeOffs, currentScenarioId: scenarioId });
  },

  addPerson: async (person) => {
    await db.people.put({ ...person, ...cloudProps() });
    set((s) => ({ people: [...s.people, person] }));
  },

  openAddPersonDrawer: () => {
    set({ addPersonDrawerOpen: true, personDrawerOpen: false, selectedPersonId: null, dayDrawerOpen: false, selectedCellInfo: null });
  },

  closeAddPersonDrawer: () => {
    set({ addPersonDrawerOpen: false });
  },

  updatePerson: async (person) => {
    await db.people.put({ ...person, ...cloudProps() });
    set((s) => ({
      people: s.people.map((p) => (p.id === person.id ? person : p)),
    }));
  },

  archivePerson: async (personId) => {
    const person = get().people.find((p) => p.id === personId);
    if (!person) return;
    const updated = { ...person, status: 'archived' as const, archivedAt: toDateStr(today()) };
    await db.people.put({ ...updated, ...cloudProps() });
    set((s) => ({
      people: s.people.map((p) => (p.id === personId ? updated : p)),
    }));
  },

  restorePerson: async (personId) => {
    const person = get().people.find((p) => p.id === personId);
    if (!person) return;
    const updated = { ...person, status: 'active' as const, archivedAt: undefined };
    await db.people.put({ ...updated, ...cloudProps() });
    set((s) => ({
      people: s.people.map((p) => (p.id === personId ? updated : p)),
    }));
  },

  selectCell: (personId, date) => {
    set({ selectedCellInfo: { personId, date }, dayDrawerOpen: true, personDrawerOpen: false, selectedPersonId: null });
  },

  closeDayDrawer: () => {
    set({ selectedCellInfo: null, dayDrawerOpen: false });
  },

  openPersonDrawer: (personId) => {
    set({ selectedPersonId: personId, personDrawerOpen: true, selectedCellInfo: null, dayDrawerOpen: false });
  },

  closePersonDrawer: () => {
    set({ selectedPersonId: null, personDrawerOpen: false });
  },

  addWorkItem: async (wi) => {
    const scenarioId = get().currentScenarioId;
    await db.workItems.put({ ...wi, scenarioId, ...cloudProps() });
    set((s) => ({ workItems: [...s.workItems, wi] }));
  },

  updateWorkItem: async (wi) => {
    const scenarioId = get().currentScenarioId;
    await db.workItems.put({ ...wi, scenarioId, ...cloudProps() });
    set((s) => ({
      workItems: s.workItems.map((w) => (w.id === wi.id ? wi : w)),
    }));
  },

  deleteWorkItem: async (id) => {
    const scenarioId = get().currentScenarioId;
    await db.workItems.delete(id);
    const toDelete = await db.allocations
      .where('[scenarioId+workItemId]')
      .equals([scenarioId, id])
      .primaryKeys();
    await db.allocations.bulkDelete(toDelete);
    set((s) => ({
      workItems: s.workItems.filter((w) => w.id !== id),
      allocations: s.allocations.filter((a) => a.workItemId !== id),
    }));
  },

  addAllocations: async (allocs) => {
    const scenarioId = get().currentScenarioId;
    const cp = cloudProps();
    await db.allocations.bulkPut(
      allocs.map((a) => ({ ...a, scenarioId, ...cp }))
    );
    set((s) => ({ allocations: [...s.allocations, ...allocs] }));
  },

  removeAllocation: async (id) => {
    await db.allocations.delete(id);
    set((s) => ({
      allocations: s.allocations.filter((a) => a.id !== id),
    }));
  },

  setAllocationForDay: async (personId, date, workItemId) => {
    const scenarioId = get().currentScenarioId;
    const newAlloc: Allocation = {
      id: crypto.randomUUID(),
      personId,
      workItemId,
      date,
      days: 1,
    };
    await db.allocations.put({ ...newAlloc, scenarioId, ...cloudProps() });
    set((s) => ({ allocations: [...s.allocations, newAlloc] }));
  },

  setAllocationForRange: async (personId, workItemId, startDate, endDate, weekdaysOnly) => {
    const scenarioId = get().currentScenarioId;
    const dates = weekdaysOnly
      ? getWeekdaysInRangeStr(startDate, endDate)
      : (() => {
          const result: string[] = [];
          const s = new Date(startDate);
          const e = new Date(endDate);
          for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            result.push(toDateStr(new Date(d)));
          }
          return result;
        })();

    const allocs: Allocation[] = dates.map((date) => ({
      id: crypto.randomUUID(),
      personId,
      workItemId,
      date,
      days: 1,
    }));

    if (allocs.length > 0) {
      const cp = cloudProps();
      await db.allocations.bulkPut(
        allocs.map((a) => ({ ...a, scenarioId, ...cp }))
      );
      set((s) => ({ allocations: [...s.allocations, ...allocs] }));
    }
  },

  clearAllocations: async (personId, startDate, endDate) => {
    const scenarioId = get().currentScenarioId;
    const allAllocs = await db.allocations
      .where('[scenarioId+personId]')
      .equals([scenarioId, personId])
      .toArray();

    const toDelete = allAllocs.filter(
      (a) => a.date >= startDate && a.date <= endDate
    );

    await db.allocations.bulkDelete(toDelete.map((a) => a.id));
    const deleteIds = new Set(toDelete.map((a) => a.id));
    set((s) => ({
      allocations: s.allocations.filter((a) => !deleteIds.has(a.id)),
    }));
  },

  copyWeekAllocations: async (personId, sourceWeekStart, targetWeekStart) => {
    const scenarioId = get().currentScenarioId;
    // Get source week weekdays (Mon-Fri)
    const srcEnd = new Date(sourceWeekStart);
    srcEnd.setDate(srcEnd.getDate() + 4); // Friday
    const srcDays = getWeekdaysInRangeStr(sourceWeekStart, toDateStr(srcEnd));

    const tgtEnd = new Date(targetWeekStart);
    tgtEnd.setDate(tgtEnd.getDate() + 4);
    const tgtDays = getWeekdaysInRangeStr(targetWeekStart, toDateStr(tgtEnd));

    // Get allocations for this person in source week
    const allAllocs = await db.allocations
      .where('[scenarioId+personId]')
      .equals([scenarioId, personId])
      .toArray();

    const srcAllocs = allAllocs.filter((a) => srcDays.includes(a.date));

    // Map source day index -> target day
    const dayMap: Record<string, string> = {};
    srcDays.forEach((d, i) => {
      if (i < tgtDays.length) dayMap[d] = tgtDays[i];
    });

    // Clear existing target week allocations first
    const tgtExisting = allAllocs.filter((a) => tgtDays.includes(a.date));
    if (tgtExisting.length > 0) {
      await db.allocations.bulkDelete(tgtExisting.map((a) => a.id));
    }

    // Create new allocations
    const newAllocs: Allocation[] = srcAllocs
      .filter((a) => dayMap[a.date])
      .map((a) => ({
        id: crypto.randomUUID(),
        personId: a.personId,
        workItemId: a.workItemId,
        date: dayMap[a.date],
        days: a.days,
      }));

    if (newAllocs.length > 0) {
      const cp = cloudProps();
      await db.allocations.bulkPut(
        newAllocs.map((a) => ({ ...a, scenarioId, ...cp }))
      );
    }

    // Reload to get clean state
    const deleteIds = new Set(tgtExisting.map((a) => a.id));
    set((s) => ({
      allocations: [
        ...s.allocations.filter((a) => !deleteIds.has(a.id)),
        ...newAllocs,
      ],
    }));
  },

  deleteAllocationsByIds: async (ids) => {
    if (ids.length === 0) return;
    await db.allocations.bulkDelete(ids);
    const deleteSet = new Set(ids);
    set((s) => ({
      allocations: s.allocations.filter((a) => !deleteSet.has(a.id)),
    }));
  },

  bulkReassign: async (updateIds, newWorkItemId, deleteConflictIds) => {
    const scenarioId = get().currentScenarioId;

    // 1. Delete conflicting allocations at destination (replace mode)
    if (deleteConflictIds.length > 0) {
      await db.allocations.bulkDelete(deleteConflictIds);
    }

    // 2. Update candidate allocations' workItemId in Dexie
    const updateSet = new Set(updateIds);
    if (updateIds.length > 0) {
      const cp = cloudProps();
      const dbAllocs = await db.allocations
        .where('scenarioId')
        .equals(scenarioId)
        .toArray();
      const toUpdate = dbAllocs.filter((a) => updateSet.has(a.id));
      await db.allocations.bulkPut(
        toUpdate.map((a) => ({ ...a, workItemId: newWorkItemId, ...cp }))
      );
    }

    // 3. Update Zustand state in one pass
    const deleteSet = new Set(deleteConflictIds);
    set((s) => ({
      allocations: s.allocations
        .filter((a) => !deleteSet.has(a.id))
        .map((a) =>
          updateSet.has(a.id)
            ? { ...a, workItemId: newWorkItemId }
            : a
        ),
    }));
  },

  batchUpdatePeopleHomePod: async (personIds, destinationPodId, updatePodLeadDefaultFilter) => {
    if (personIds.length === 0) return;
    const idSet = new Set(personIds);
    const { people } = get();

    const updatedPeople = people.map((p) => {
      if (!idSet.has(p.id)) return p;
      const updated = { ...p, homePodId: destinationPodId };
      if (updatePodLeadDefaultFilter && p.role === 'pod_lead') {
        updated.defaultPodFilterIds = [destinationPodId];
      }
      return updated;
    });

    // Batch persist to Dexie
    const cp = cloudProps();
    const toWrite = updatedPeople.filter((p) => idSet.has(p.id));
    await db.people.bulkPut(toWrite.map((p) => ({ ...p, ...cp })));

    set({ people: updatedPeople });
  },

  batchUpdatePeopleLead: async (personIds, leadId) => {
    if (personIds.length === 0) return;
    const idSet = new Set(personIds);
    const { people } = get();

    const updatedPeople = people.map((p) => {
      if (!idSet.has(p.id)) return p;
      return { ...p, leadId };
    });

    const cp = cloudProps();
    const toWrite = updatedPeople.filter((p) => idSet.has(p.id));
    await db.people.bulkPut(toWrite.map((p) => ({ ...p, ...cp })));

    set({ people: updatedPeople });
  },

  addTimeOff: async (to) => {
    const scenarioId = get().currentScenarioId;
    await db.timeOffs.put({ ...to, scenarioId, ...cloudProps() });
    set((s) => ({ timeOffs: [...s.timeOffs, to] }));
  },

  removeTimeOff: async (id) => {
    await db.timeOffs.delete(id);
    set((s) => ({ timeOffs: s.timeOffs.filter((t) => t.id !== id) }));
  },

  addTimeOffForRange: async (personId, startDate, endDate, weekdaysOnly, reason) => {
    const scenarioId = get().currentScenarioId;
    const dates = weekdaysOnly
      ? getWeekdaysInRangeStr(startDate, endDate)
      : (() => {
          const result: string[] = [];
          const s = new Date(startDate);
          const e = new Date(endDate);
          for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            result.push(toDateStr(new Date(d)));
          }
          return result;
        })();

    // Skip dates that already have time off for this person
    const existingDates = new Set(
      get().timeOffs.filter((t) => t.personId === personId).map((t) => t.date)
    );
    const newDates = dates.filter((d) => !existingDates.has(d));
    if (newDates.length === 0) return 0;

    // Create time-off entries
    const newTimeOffs: TimeOff[] = newDates.map((date) => ({
      id: crypto.randomUUID(),
      personId,
      date,
      reason: reason || undefined,
    }));

    // Remove conflicting allocations for these dates
    const dateSet = new Set(newDates);
    const conflictAllocs = get().allocations.filter(
      (a) => a.personId === personId && dateSet.has(a.date)
    );
    if (conflictAllocs.length > 0) {
      await db.allocations.bulkDelete(conflictAllocs.map((a) => a.id));
    }

    // Persist time-off entries
    const cp = cloudProps();
    await db.timeOffs.bulkPut(
      newTimeOffs.map((to) => ({ ...to, scenarioId, ...cp }))
    );

    const deleteIds = new Set(conflictAllocs.map((a) => a.id));
    set((s) => ({
      timeOffs: [...s.timeOffs, ...newTimeOffs],
      allocations: deleteIds.size > 0
        ? s.allocations.filter((a) => !deleteIds.has(a.id))
        : s.allocations,
    }));

    return newTimeOffs.length;
  },

  removeTimeOffsForRange: async (personId, startDate, endDate) => {
    const toRemove = get().timeOffs.filter(
      (t) => t.personId === personId && t.date >= startDate && t.date <= endDate
    );
    if (toRemove.length === 0) return 0;

    await db.timeOffs.bulkDelete(toRemove.map((t) => t.id));
    const deleteIds = new Set(toRemove.map((t) => t.id));
    set((s) => ({
      timeOffs: s.timeOffs.filter((t) => !deleteIds.has(t.id)),
    }));

    return toRemove.length;
  },

  duplicateScenario: async (sourceId, newName) => {
    const newId = crypto.randomUUID();
    const newScenario: Scenario = { id: newId, name: newName, isBase: false };
    const cp = cloudProps();

    await db.scenarios.put({ ...newScenario, ...cp });

    const srcWorkItems = await db.workItems
      .where('scenarioId')
      .equals(sourceId)
      .toArray();
    const newWorkItems = srcWorkItems.map((wi) => ({
      ...wi,
      id: crypto.randomUUID(),
      scenarioId: newId,
      ...cp,
    }));

    const wiIdMap: Record<string, string> = {};
    srcWorkItems.forEach((old, i) => {
      wiIdMap[old.id] = newWorkItems[i].id;
    });

    await db.workItems.bulkPut(newWorkItems);

    const srcAllocs = await db.allocations
      .where('scenarioId')
      .equals(sourceId)
      .toArray();
    await db.allocations.bulkPut(
      srcAllocs.map((a) => ({
        ...a,
        id: crypto.randomUUID(),
        scenarioId: newId,
        workItemId: wiIdMap[a.workItemId] || a.workItemId,
        ...cp,
      }))
    );

    const srcTimeOffs = await db.timeOffs
      .where('scenarioId')
      .equals(sourceId)
      .toArray();
    await db.timeOffs.bulkPut(
      srcTimeOffs.map((to) => ({
        ...to,
        id: crypto.randomUUID(),
        scenarioId: newId,
        ...cp,
      }))
    );

    set((s) => ({ scenarios: [...s.scenarios, newScenario] }));
    return newId;
  },

  setEditMode: (on) => {
    set({ editMode: on, selectedCells: new Set<string>(), selectionPersonId: null, isSelecting: false });
    // Close any open drawers when entering edit mode
    if (on) {
      set({ dayDrawerOpen: false, selectedCellInfo: null, personDrawerOpen: false, selectedPersonId: null });
    }
  },

  toggleCellSelection: (personId, date) => {
    set((s) => {
      const key = `${personId}|${date}`;
      const next = new Set(s.selectedCells);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { selectedCells: next };
    });
  },

  startDragSelection: (personId, date) => {
    const key = `${personId}|${date}`;
    const next = new Set<string>();
    next.add(key);
    set({ selectedCells: next, selectionPersonId: personId, isSelecting: true });
  },

  extendDragSelection: (personId, date) => {
    const { isSelecting, selectionPersonId } = get();
    if (!isSelecting) return;
    // Row-paint: ignore if different person
    if (personId !== selectionPersonId) return;
    const key = `${personId}|${date}`;
    set((s) => {
      if (s.selectedCells.has(key)) return s; // already selected, skip re-render
      const next = new Set(s.selectedCells);
      next.add(key);
      return { selectedCells: next };
    });
  },

  endDragSelection: () => {
    set({ isSelecting: false });
  },

  clearSelection: () => {
    set({ selectedCells: new Set<string>(), selectionPersonId: null, isSelecting: false });
  },

  batchAssign: async (workItemId, mode = 'replace') => {
    const { selectedCells, allocations, currentScenarioId } = get();
    if (selectedCells.size === 0) return;

    const scenarioId = currentScenarioId;
    const cp = cloudProps();

    if (mode === 'replace') {
      // Delete existing allocations in selected cells first
      const toDelete = allocations.filter((a) =>
        selectedCells.has(`${a.personId}|${a.date}`)
      );
      if (toDelete.length > 0) {
        await db.allocations.bulkDelete(toDelete.map((a) => a.id));
      }

      // Create new allocations
      const allocs: Allocation[] = [];
      for (const key of selectedCells) {
        const [personId, date] = key.split('|');
        allocs.push({
          id: crypto.randomUUID(),
          personId,
          workItemId,
          date,
          days: 1,
        });
      }

      await db.allocations.bulkPut(
        allocs.map((a) => ({ ...a, scenarioId, ...cp }))
      );

      const deleteIds = new Set(toDelete.map((a) => a.id));
      set((s) => ({
        allocations: [
          ...s.allocations.filter((a) => !deleteIds.has(a.id)),
          ...allocs,
        ],
        selectedCells: new Set<string>(),
        selectionPersonId: null,
      }));
    } else {
      // Skip conflicts: only create allocation if no allocation exists for that cell
      const existingKeys = new Set(
        allocations.map((a) => `${a.personId}|${a.date}`)
      );
      const allocs: Allocation[] = [];
      for (const key of selectedCells) {
        if (existingKeys.has(key)) continue; // skip
        const [personId, date] = key.split('|');
        allocs.push({
          id: crypto.randomUUID(),
          personId,
          workItemId,
          date,
          days: 1,
        });
      }

      if (allocs.length > 0) {
        await db.allocations.bulkPut(
          allocs.map((a) => ({ ...a, scenarioId, ...cp }))
        );
      }

      set((s) => ({
        allocations: [...s.allocations, ...allocs],
        selectedCells: new Set<string>(),
        selectionPersonId: null,
      }));
    }
  },

  batchClear: async () => {
    const { selectedCells, allocations } = get();
    if (selectedCells.size === 0) return;

    // Find all allocation IDs that match the selected cells
    const toDelete = allocations.filter((a) =>
      selectedCells.has(`${a.personId}|${a.date}`)
    );

    if (toDelete.length > 0) {
      await db.allocations.bulkDelete(toDelete.map((a) => a.id));
    }

    const deleteIds = new Set(toDelete.map((a) => a.id));
    set((s) => ({
      allocations: s.allocations.filter((a) => !deleteIds.has(a.id)),
      selectedCells: new Set<string>(),
      selectionPersonId: null,
    }));
  },

  setShowArchivedPeople: (show) => set({ showArchivedPeople: show }),
  setPodFilterIds: (ids) => set({ podFilterIds: ids }),
  setActiveWeekStartDate: (date) => set({ activeWeekStartDate: date }),

  exportData: async () => {
    const pods = await db.pods.toArray();
    const people = await db.people.toArray();
    const scenarios = await db.scenarios.toArray();

    const scenarioDataList = [];
    for (const scenario of scenarios) {
      const workItems = (
        await db.workItems
          .where('scenarioId')
          .equals(scenario.id)
          .toArray()
      ).map(({ scenarioId, ...wi }) => wi);

      const allocations = (
        await db.allocations
          .where('scenarioId')
          .equals(scenario.id)
          .toArray()
      ).map(({ scenarioId, ...a }) => a);

      const timeOffs = (
        await db.timeOffs
          .where('scenarioId')
          .equals(scenario.id)
          .toArray()
      ).map(({ scenarioId, ...to }) => to);

      scenarioDataList.push({ scenario, allocations, workItems, timeOffs });
    }

    return { pods, people, scenarios: scenarioDataList };
  },

  importData: async (data) => {
    await db.pods.clear();
    await db.people.clear();
    await db.scenarios.clear();
    await db.workItems.clear();
    await db.allocations.clear();
    await db.timeOffs.clear();

    const cp = cloudProps();

    await db.pods.bulkPut(data.pods.map((p) => ({ ...p, ...cp })));
    await db.people.bulkPut(data.people.map((p) => ({ ...p, ...cp })));

    for (const sd of data.scenarios) {
      await db.scenarios.put({ ...sd.scenario, ...cp });
      await db.workItems.bulkPut(
        sd.workItems.map((wi) => ({ ...wi, scenarioId: sd.scenario.id, ...cp }))
      );
      await db.allocations.bulkPut(
        sd.allocations.map((a) => ({ ...a, scenarioId: sd.scenario.id, ...cp }))
      );
      await db.timeOffs.bulkPut(
        sd.timeOffs.map((to) => ({ ...to, scenarioId: sd.scenario.id, ...cp }))
      );
    }

    const baseScenario = data.scenarios.find((s) => s.scenario.isBase);
    const firstScenarioId = baseScenario
      ? baseScenario.scenario.id
      : data.scenarios[0]?.scenario.id || '';

    set({
      pods: data.pods,
      people: data.people,
      scenarios: data.scenarios.map((s) => s.scenario),
    });

    if (firstScenarioId) {
      await get().loadScenarioData(firstScenarioId);
    }
  },

  resetData: async () => {
    // Clear all data tables
    await db.pods.clear();
    await db.people.clear();
    await db.scenarios.clear();
    await db.workItems.clear();
    await db.allocations.clear();
    await db.timeOffs.clear();

    // Seed directly (don't call initialize() — it waits for cloud sync
    // which would pull stale data before we can seed fresh data)
    await seedDatabase();

    // Read freshly seeded data from DB
    const pods = await db.pods.toArray();
    const people = await db.people.toArray();
    const scenarios = await db.scenarios.toArray();

    set({
      pods,
      people,
      scenarios,
      workItems: [],
      allocations: [],
      timeOffs: [],
      currentScenarioId: 'scenario-base',
      currentScreen: 'roster',
      podFilterIds: [],
      editMode: false,
      selectedCells: new Set<string>(),
      selectionPersonId: null,
      isSelecting: false,
      dayDrawerOpen: false,
      selectedCellInfo: null,
      personDrawerOpen: false,
      selectedPersonId: null,
    });

    await get().loadScenarioData('scenario-base');
  },

  inviteTeamMember: async (email) => {
    if (!isCloudEnabled) return;
    await db.table('members').add({
      realmId: TEAM_REALM_ID,
      email,
      invite: true,
      roles: ['editor'],
    });
  },
}));
