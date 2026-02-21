export interface Pod {
  id: string;
  name: string;
}

export type PersonRole = 'qa_lead' | 'pod_lead' | 'tester';
export type PersonType = 'internal' | 'vendor';
export type PersonStatus = 'active' | 'archived';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  homePodId?: string;
  type: PersonType;
  weeklyCapacityDays: number;
  status: PersonStatus;
  archivedAt?: string; // ISO date YYYY-MM-DD
  defaultPodFilterIds?: string[];
}

export type WorkItemType = 'feature' | 'initiative';

export interface WorkItem {
  id: string;
  type: WorkItemType;
  name: string;
  podId: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;
  requiredMinDaysPerWeek: number;
  releaseDate?: string;
  notes?: string;
}

export interface Allocation {
  id: string;
  personId: string;
  workItemId: string;
  date: string; // ISO date string YYYY-MM-DD
  days: number; // always 1.0 in V1
}

export interface TimeOff {
  id: string;
  personId: string;
  date: string; // ISO date string YYYY-MM-DD
  reason?: string;
}

export interface Scenario {
  id: string;
  name: string;
  isBase: boolean;
}

export interface ScenarioData {
  scenario: Scenario;
  allocations: Allocation[];
  workItems: WorkItem[];
  timeOffs: TimeOff[];
}

export interface AppData {
  pods: Pod[];
  people: Person[];
  scenarios: ScenarioData[];
}

export type RiskLevel = 'green' | 'yellow' | 'red';

export interface CoverageRisk {
  workItemId: string;
  weekStart: string;
  planned: number;
  required: number;
  level: RiskLevel;
}

export interface FeasibilityRisk {
  workItemId: string;
  remainingRequired: number;
  remainingPlanned: number;
  level: RiskLevel;
}

export interface ContextSwitchingRisk {
  personId: string;
  weekStart: string;
  distinctWorkItems: number;
  level: RiskLevel;
}

export interface CapacityRisk {
  personId: string;
  weekStart: string;
  assignedDays: number;
  cap: number;
  level: RiskLevel;
}

// Pod grouping for roster
export interface PodSubgroup {
  pod: Pod;
  people: Person[];
}

export interface PodGroup {
  lead: Person | null; // null for Emily (QA lead, no pod group)
  label: string;
  pods: PodSubgroup[];
}
