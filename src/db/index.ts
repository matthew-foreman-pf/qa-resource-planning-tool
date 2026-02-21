import Dexie, { type Table } from 'dexie';
import type { Pod, Person, WorkItem, Allocation, TimeOff, Scenario } from '../types';

export class AppDatabase extends Dexie {
  pods!: Table<Pod>;
  people!: Table<Person>;
  workItems!: Table<WorkItem & { scenarioId: string }>;
  allocations!: Table<Allocation & { scenarioId: string }>;
  timeOffs!: Table<TimeOff & { scenarioId: string }>;
  scenarios!: Table<Scenario>;

  constructor() {
    super('QAResourcePlanning');
    this.version(1).stores({
      pods: 'id',
      people: 'id, role, type, homePodId',
      workItems: 'id, scenarioId, podId, [scenarioId+podId]',
      allocations: 'id, scenarioId, personId, workItemId, date, [scenarioId+personId], [scenarioId+workItemId], [scenarioId+date]',
      timeOffs: 'id, scenarioId, personId, date, [scenarioId+personId]',
      scenarios: 'id, isBase',
    });
    this.version(2).stores({
      pods: 'id',
      people: 'id, role, type, homePodId, status',
      workItems: 'id, scenarioId, podId, [scenarioId+podId]',
      allocations: 'id, scenarioId, personId, workItemId, date, [scenarioId+personId], [scenarioId+workItemId], [scenarioId+date]',
      timeOffs: 'id, scenarioId, personId, date, [scenarioId+personId]',
      scenarios: 'id, isBase',
    }).upgrade((tx) => {
      return tx.table('people').toCollection().modify((person: any) => {
        if (!person.status) {
          person.status = 'active';
        }
      });
    });
  }
}

export const db = new AppDatabase();
