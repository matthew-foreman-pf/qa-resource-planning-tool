import { create } from 'zustand';
import { db } from '../db';
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
} from '../db/seed';
import { toDateStr, today, getWeekdaysInRangeStr, getWeekStart } from '../utils/dates';

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
  currentScreen: 'roster' | 'dashboard' | 'editPlan' | 'workItems' | 'people';
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

  // Edit mode (multi-select)
  editMode: boolean;
  selectedCells: Set<string>; // "personId|date" keys

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

  // Edit mode (multi-select)
  setEditMode: (on: boolean) => void;
  toggleCellSelection: (personId: string, date: string) => void;
  clearSelection: () => void;
  batchAssign: (workItemId: string) => Promise<void>;
  batchClear: () => Promise<void>;

  // UI toggles
  setShowArchivedPeople: (show: boolean) => void;
  setPodFilterIds: (ids: string[]) => void;
  setActiveWeekStartDate: (date: string) => void;

  // Import/Export
  exportData: () => Promise<AppData>;
  importData: (data: AppData) => Promise<void>;
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
  activeWeekStartDate: toDateStr(getWeekStart(today())),

  initialize: async () => {
    // Check if DB has data
    const scenarioCount = await db.scenarios.count();
    if (scenarioCount === 0) {
      // Seed the database
      await db.pods.bulkPut(seedPods);
      await db.people.bulkPut(seedPeople);
      await db.scenarios.put(basePlanScenario);

      const workItems = generateSeedWorkItems();
      await db.workItems.bulkPut(
        workItems.map((wi) => ({ ...wi, scenarioId: 'scenario-base' }))
      );

      const allocations = generateSeedAllocations(workItems);
      await db.allocations.bulkPut(
        allocations.map((a) => ({ ...a, scenarioId: 'scenario-base' }))
      );

      const timeOffs = generateSeedTimeOffs();
      await db.timeOffs.bulkPut(
        timeOffs.map((to) => ({ ...to, scenarioId: 'scenario-base' }))
      );
    }

    const pods = await db.pods.toArray();
    const people = await db.people.toArray();
    const scenarios = await db.scenarios.toArray();

    // Hardcoded currentUserId for testing (Emily = QA Lead sees all)
    const currentUserId = 'person-emily';
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
    await db.people.put(person);
    set((s) => ({ people: [...s.people, person] }));
  },

  openAddPersonDrawer: () => {
    set({ addPersonDrawerOpen: true, personDrawerOpen: false, selectedPersonId: null, dayDrawerOpen: false, selectedCellInfo: null });
  },

  closeAddPersonDrawer: () => {
    set({ addPersonDrawerOpen: false });
  },

  updatePerson: async (person) => {
    await db.people.put(person);
    set((s) => ({
      people: s.people.map((p) => (p.id === person.id ? person : p)),
    }));
  },

  archivePerson: async (personId) => {
    const person = get().people.find((p) => p.id === personId);
    if (!person) return;
    const updated = { ...person, status: 'archived' as const, archivedAt: toDateStr(today()) };
    await db.people.put(updated);
    set((s) => ({
      people: s.people.map((p) => (p.id === personId ? updated : p)),
    }));
  },

  restorePerson: async (personId) => {
    const person = get().people.find((p) => p.id === personId);
    if (!person) return;
    const updated = { ...person, status: 'active' as const, archivedAt: undefined };
    await db.people.put(updated);
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
    await db.workItems.put({ ...wi, scenarioId });
    set((s) => ({ workItems: [...s.workItems, wi] }));
  },

  updateWorkItem: async (wi) => {
    const scenarioId = get().currentScenarioId;
    await db.workItems.put({ ...wi, scenarioId });
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
    await db.allocations.bulkPut(
      allocs.map((a) => ({ ...a, scenarioId }))
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
    await db.allocations.put({ ...newAlloc, scenarioId });
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
      await db.allocations.bulkPut(
        allocs.map((a) => ({ ...a, scenarioId }))
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
      await db.allocations.bulkPut(
        newAllocs.map((a) => ({ ...a, scenarioId }))
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
      const dbAllocs = await db.allocations
        .where('scenarioId')
        .equals(scenarioId)
        .toArray();
      const toUpdate = dbAllocs.filter((a) => updateSet.has(a.id));
      await db.allocations.bulkPut(
        toUpdate.map((a) => ({ ...a, workItemId: newWorkItemId }))
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
    const toWrite = updatedPeople.filter((p) => idSet.has(p.id));
    await db.people.bulkPut(toWrite);

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

    const toWrite = updatedPeople.filter((p) => idSet.has(p.id));
    await db.people.bulkPut(toWrite);

    set({ people: updatedPeople });
  },

  addTimeOff: async (to) => {
    const scenarioId = get().currentScenarioId;
    await db.timeOffs.put({ ...to, scenarioId });
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
    await db.timeOffs.bulkPut(
      newTimeOffs.map((to) => ({ ...to, scenarioId }))
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

    await db.scenarios.put(newScenario);

    const srcWorkItems = await db.workItems
      .where('scenarioId')
      .equals(sourceId)
      .toArray();
    const newWorkItems = srcWorkItems.map((wi) => ({
      ...wi,
      id: crypto.randomUUID(),
      scenarioId: newId,
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
      }))
    );

    set((s) => ({ scenarios: [...s.scenarios, newScenario] }));
    return newId;
  },

  setEditMode: (on) => {
    set({ editMode: on, selectedCells: new Set<string>() });
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

  clearSelection: () => {
    set({ selectedCells: new Set<string>() });
  },

  batchAssign: async (workItemId) => {
    const { selectedCells, currentScenarioId } = get();
    if (selectedCells.size === 0) return;

    const scenarioId = currentScenarioId;
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
      allocs.map((a) => ({ ...a, scenarioId }))
    );
    set((s) => ({
      allocations: [...s.allocations, ...allocs],
      selectedCells: new Set<string>(),
    }));
  },

  batchClear: async () => {
    const { selectedCells, allocations, currentScenarioId } = get();
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

    await db.pods.bulkPut(data.pods);
    await db.people.bulkPut(data.people);

    for (const sd of data.scenarios) {
      await db.scenarios.put(sd.scenario);
      await db.workItems.bulkPut(
        sd.workItems.map((wi) => ({ ...wi, scenarioId: sd.scenario.id }))
      );
      await db.allocations.bulkPut(
        sd.allocations.map((a) => ({ ...a, scenarioId: sd.scenario.id }))
      );
      await db.timeOffs.bulkPut(
        sd.timeOffs.map((to) => ({ ...to, scenarioId: sd.scenario.id }))
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
}));
