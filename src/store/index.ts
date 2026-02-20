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
  currentScreen: 'roster' | 'dashboard' | 'editPlan' | 'workItems';
  selectedCellInfo: {
    personId: string;
    date: string;
  } | null;
  sidePanelOpen: boolean;

  // Actions
  initialize: () => Promise<void>;
  setScreen: (screen: AppState['currentScreen']) => void;
  setScenario: (scenarioId: string) => void;
  loadScenarioData: (scenarioId: string) => Promise<void>;

  // Cell selection
  selectCell: (personId: string, date: string) => void;
  closeSidePanel: () => void;

  // Work item CRUD
  addWorkItem: (wi: WorkItem) => Promise<void>;
  updateWorkItem: (wi: WorkItem) => Promise<void>;
  deleteWorkItem: (id: string) => Promise<void>;

  // Allocation CRUD
  addAllocations: (allocs: Allocation[]) => Promise<void>;
  clearAllocations: (personId: string, startDate: string, endDate: string) => Promise<void>;

  // Time off
  addTimeOff: (to: TimeOff) => Promise<void>;
  removeTimeOff: (id: string) => Promise<void>;

  // Scenario management
  duplicateScenario: (sourceId: string, newName: string) => Promise<string>;

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
  sidePanelOpen: false,

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

    set({ pods, people, scenarios });
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

  selectCell: (personId, date) => {
    set({ selectedCellInfo: { personId, date }, sidePanelOpen: true });
  },

  closeSidePanel: () => {
    set({ selectedCellInfo: null, sidePanelOpen: false });
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
    // Also delete associated allocations
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

  addTimeOff: async (to) => {
    const scenarioId = get().currentScenarioId;
    await db.timeOffs.put({ ...to, scenarioId });
    set((s) => ({ timeOffs: [...s.timeOffs, to] }));
  },

  removeTimeOff: async (id) => {
    await db.timeOffs.delete(id);
    set((s) => ({ timeOffs: s.timeOffs.filter((t) => t.id !== id) }));
  },

  duplicateScenario: async (sourceId, newName) => {
    const newId = crypto.randomUUID();
    const newScenario: Scenario = { id: newId, name: newName, isBase: false };

    await db.scenarios.put(newScenario);

    // Copy work items
    const srcWorkItems = await db.workItems
      .where('scenarioId')
      .equals(sourceId)
      .toArray();
    const newWorkItems = srcWorkItems.map((wi) => ({
      ...wi,
      id: crypto.randomUUID(),
      scenarioId: newId,
    }));

    // Build a map of old work item IDs to new IDs
    const wiIdMap: Record<string, string> = {};
    srcWorkItems.forEach((old, i) => {
      wiIdMap[old.id] = newWorkItems[i].id;
    });

    await db.workItems.bulkPut(newWorkItems);

    // Copy allocations
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

    // Copy time offs
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
    // Clear everything
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
