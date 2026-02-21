import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { getWeekdaysInRangeStr, toDateStr, today } from '../../utils/dates';
import { getWorkItemLabel } from '../../utils/helpers';
import { addWeeks } from 'date-fns';
import type { Allocation } from '../../types';

export function EditPlanScreen() {
  return (
    <div className="edit-plan-screen">
      <h2>Edit Plan</h2>
      <p className="screen-subtitle">Bulk assignment and quick actions for editors</p>
      <div className="edit-plan-sections">
        <BulkAssignmentForm />
        <BulkUnassignForm />
        <BulkReassignForm />
        <QuickActions />
      </div>
    </div>
  );
}

/* ============================================
   BULK ASSIGNMENT (existing)
   ============================================ */

function BulkAssignmentForm() {
  const workItems = useStore((s) => s.workItems);
  const people = useStore((s) => s.people);
  const addAllocations = useStore((s) => s.addAllocations);

  const [selectedWorkItem, setSelectedWorkItem] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(toDateStr(today()));
  const [endDate, setEndDate] = useState(
    toDateStr(addWeeks(today(), 1))
  );
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [message, setMessage] = useState('');

  const handleApply = async () => {
    if (!selectedWorkItem || selectedPeople.length === 0) {
      setMessage('Please select a work item and at least one person.');
      return;
    }

    let dates: string[];
    if (weekdaysOnly) {
      dates = getWeekdaysInRangeStr(startDate, endDate);
    } else {
      // This shouldn't happen in V1 but handle it
      dates = getWeekdaysInRangeStr(startDate, endDate);
    }

    if (dates.length === 0) {
      setMessage('No weekdays in the selected range.');
      return;
    }

    const allocs = [];
    for (const personId of selectedPeople) {
      for (const date of dates) {
        allocs.push({
          id: crypto.randomUUID(),
          personId,
          workItemId: selectedWorkItem,
          date,
          days: 1,
        });
      }
    }

    await addAllocations(allocs);
    setMessage(
      `Created ${allocs.length} allocations for ${selectedPeople.length} people across ${dates.length} days.`
    );
  };

  const togglePerson = (personId: string) => {
    setSelectedPeople((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    );
  };

  return (
    <section className="edit-section">
      <h3>Bulk Assignment</h3>
      <div className="form-group">
        <label>Work Item</label>
        <select
          value={selectedWorkItem}
          onChange={(e) => setSelectedWorkItem(e.target.value)}
        >
          <option value="">-- Select Work Item --</option>
          {workItems.map((wi) => (
            <option key={wi.id} value={wi.id}>
              {getWorkItemLabel(wi)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>People (multi-select)</label>
        <div className="people-checkboxes">
          {people.map((p) => (
            <label key={p.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedPeople.includes(p.id)}
                onChange={() => togglePerson(p.id)}
              />
              {p.name}
              {p.type === 'vendor' ? ' (V)' : ''}
            </label>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={weekdaysOnly}
            onChange={(e) => setWeekdaysOnly(e.target.checked)}
          />
          Weekdays only
        </label>
      </div>

      <button className="btn btn--primary" onClick={handleApply}>
        Apply Allocations
      </button>

      {message && <div className="form-message">{message}</div>}
    </section>
  );
}

/* ============================================
   BULK UNASSIGN (new)
   ============================================ */

type UnassignScope = 'people' | 'workItem' | 'pod';

function BulkUnassignForm() {
  const workItems = useStore((s) => s.workItems);
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const allocations = useStore((s) => s.allocations);
  const deleteAllocationsByIds = useStore((s) => s.deleteAllocationsByIds);

  const [scope, setScope] = useState<UnassignScope>('people');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedWorkItemScope, setSelectedWorkItemScope] = useState('');
  const [selectedPod, setSelectedPod] = useState('');
  const [startDate, setStartDate] = useState(toDateStr(today()));
  const [endDate, setEndDate] = useState(toDateStr(addWeeks(today(), 1)));
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [workItemFilter, setWorkItemFilter] = useState('');
  const [message, setMessage] = useState('');

  const togglePerson = (personId: string) => {
    setSelectedPeople((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    );
  };

  // Resolve which person IDs are targeted based on scope
  const targetPersonIds = useMemo((): Set<string> | null => {
    switch (scope) {
      case 'people':
        return selectedPeople.length > 0 ? new Set(selectedPeople) : null;
      case 'workItem': {
        // "Work Item" scope means all people assigned to this work item — no person filter
        return null; // null signals "any person"
      }
      case 'pod': {
        if (!selectedPod) return new Set<string>(); // empty = nothing selected
        const podPeople = people.filter((p) => p.homePodId === selectedPod);
        return new Set(podPeople.map((p) => p.id));
      }
      default:
        return new Set<string>();
    }
  }, [scope, selectedPeople, selectedPod, people]);

  // Compute matching allocations (live preview)
  const matchingAllocations = useMemo((): Allocation[] => {
    // Date range
    const dates = weekdaysOnly
      ? new Set(getWeekdaysInRangeStr(startDate, endDate))
      : (() => {
          const s = new Set<string>();
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            s.add(toDateStr(new Date(d)));
          }
          return s;
        })();

    if (dates.size === 0) return [];

    return allocations.filter((a) => {
      // Date range check
      if (!dates.has(a.date)) return false;

      // Scope-based person check
      if (scope === 'people') {
        if (!targetPersonIds || targetPersonIds.size === 0) return false;
        if (!targetPersonIds.has(a.personId)) return false;
      } else if (scope === 'workItem') {
        if (!selectedWorkItemScope) return false;
        if (a.workItemId !== selectedWorkItemScope) return false;
      } else if (scope === 'pod') {
        if (!targetPersonIds || targetPersonIds.size === 0) return false;
        if (!targetPersonIds.has(a.personId)) return false;
      }

      // Optional work item filter (narrows further)
      if (workItemFilter && a.workItemId !== workItemFilter) return false;

      return true;
    });
  }, [allocations, startDate, endDate, weekdaysOnly, scope, targetPersonIds, selectedWorkItemScope, workItemFilter]);

  const handleApply = async () => {
    if (matchingAllocations.length === 0) {
      setMessage('No matching assignments to remove.');
      return;
    }

    await deleteAllocationsByIds(matchingAllocations.map((a) => a.id));
    setMessage(`Removed ${matchingAllocations.length} assignment${matchingAllocations.length !== 1 ? 's' : ''}.`);
  };

  // Scope-specific validation message
  const scopeReady = useMemo(() => {
    switch (scope) {
      case 'people':
        return selectedPeople.length > 0;
      case 'workItem':
        return !!selectedWorkItemScope;
      case 'pod':
        return !!selectedPod;
    }
  }, [scope, selectedPeople, selectedWorkItemScope, selectedPod]);

  return (
    <section className="edit-section">
      <h3>Bulk Unassign</h3>

      {/* Scope selector */}
      <div className="form-group">
        <label>Scope</label>
        <div className="bulk-unassign-scopes">
          <label className="radio-label">
            <input
              type="radio"
              name="unassign-scope"
              checked={scope === 'people'}
              onChange={() => setScope('people')}
            />
            People
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="unassign-scope"
              checked={scope === 'workItem'}
              onChange={() => setScope('workItem')}
            />
            Work Item
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="unassign-scope"
              checked={scope === 'pod'}
              onChange={() => setScope('pod')}
            />
            Pod
          </label>
        </div>
      </div>

      {/* Scope-specific inputs */}
      {scope === 'people' && (
        <div className="form-group">
          <label>People (multi-select)</label>
          <div className="people-checkboxes">
            {people.filter((p) => p.status === 'active').map((p) => (
              <label key={p.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(p.id)}
                  onChange={() => togglePerson(p.id)}
                />
                {p.name}
                {p.type === 'vendor' ? ' (V)' : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      {scope === 'workItem' && (
        <div className="form-group">
          <label>Work Item (clears all people assigned to it)</label>
          <select
            value={selectedWorkItemScope}
            onChange={(e) => setSelectedWorkItemScope(e.target.value)}
          >
            <option value="">-- Select Work Item --</option>
            {workItems.map((wi) => (
              <option key={wi.id} value={wi.id}>
                {getWorkItemLabel(wi)}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope === 'pod' && (
        <div className="form-group">
          <label>Pod (clears all people whose home pod matches)</label>
          <select
            value={selectedPod}
            onChange={(e) => setSelectedPod(e.target.value)}
          >
            <option value="">-- Select Pod --</option>
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date range */}
      <div className="form-row">
        <div className="form-group">
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={weekdaysOnly}
            onChange={(e) => setWeekdaysOnly(e.target.checked)}
          />
          Weekdays only
        </label>
      </div>

      {/* Optional work item filter (only for people/pod scope) */}
      {scope !== 'workItem' && (
        <div className="form-group">
          <label>Only clear allocations for work item (optional)</label>
          <select
            value={workItemFilter}
            onChange={(e) => setWorkItemFilter(e.target.value)}
          >
            <option value="">Any work item</option>
            {workItems.map((wi) => (
              <option key={wi.id} value={wi.id}>
                {getWorkItemLabel(wi)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Live preview count */}
      <div className="bulk-unassign-preview">
        {scopeReady ? (
          matchingAllocations.length > 0 ? (
            <span className="preview-count preview-count--warn">
              Will remove <strong>{matchingAllocations.length}</strong> assignment{matchingAllocations.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="preview-count preview-count--empty">No matching assignments found</span>
          )
        ) : (
          <span className="preview-count preview-count--empty">Select a scope target above</span>
        )}
      </div>

      <button
        className="btn btn--danger"
        onClick={handleApply}
        disabled={matchingAllocations.length === 0}
      >
        Remove Assignments
      </button>

      {message && <div className="form-message">{message}</div>}
    </section>
  );
}

/* ============================================
   BULK REASSIGN (new)
   ============================================ */

type ReassignScope = 'people' | 'workItem' | 'pod';
type ConflictMode = 'replace' | 'skip';

function BulkReassignForm() {
  const workItems = useStore((s) => s.workItems);
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const allocations = useStore((s) => s.allocations);
  const bulkReassign = useStore((s) => s.bulkReassign);

  const [scope, setScope] = useState<ReassignScope>('people');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedWorkItemScope, setSelectedWorkItemScope] = useState('');
  const [selectedPod, setSelectedPod] = useState('');
  const [startDate, setStartDate] = useState(toDateStr(today()));
  const [endDate, setEndDate] = useState(toDateStr(addWeeks(today(), 1)));
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [destinationWorkItem, setDestinationWorkItem] = useState('');
  const [conflictMode, setConflictMode] = useState<ConflictMode>('replace');
  const [message, setMessage] = useState('');

  const togglePerson = (personId: string) => {
    setSelectedPeople((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    );
  };

  // Build date set for the range
  const dateSet = useMemo(() => {
    if (weekdaysOnly) {
      return new Set(getWeekdaysInRangeStr(startDate, endDate));
    }
    const s = new Set<string>();
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      s.add(toDateStr(new Date(d)));
    }
    return s;
  }, [startDate, endDate, weekdaysOnly]);

  // Resolve target person IDs based on scope
  const targetPersonIds = useMemo((): Set<string> | null => {
    switch (scope) {
      case 'people':
        return selectedPeople.length > 0 ? new Set(selectedPeople) : null;
      case 'workItem':
        return null; // any person
      case 'pod': {
        if (!selectedPod) return new Set<string>();
        return new Set(people.filter((p) => p.homePodId === selectedPod).map((p) => p.id));
      }
      default:
        return new Set<string>();
    }
  }, [scope, selectedPeople, selectedPod, people]);

  // Candidate allocations to move
  const candidates = useMemo((): Allocation[] => {
    if (dateSet.size === 0 || !destinationWorkItem) return [];

    return allocations.filter((a) => {
      if (!dateSet.has(a.date)) return false;

      // Don't move allocations that are already on the destination
      if (a.workItemId === destinationWorkItem) return false;

      // Scope check
      if (scope === 'people') {
        if (!targetPersonIds || targetPersonIds.size === 0) return false;
        if (!targetPersonIds.has(a.personId)) return false;
      } else if (scope === 'workItem') {
        if (!selectedWorkItemScope) return false;
        if (a.workItemId !== selectedWorkItemScope) return false;
      } else if (scope === 'pod') {
        if (!targetPersonIds || targetPersonIds.size === 0) return false;
        if (!targetPersonIds.has(a.personId)) return false;
      }

      // Optional source filter
      if (sourceFilter && a.workItemId !== sourceFilter) return false;

      return true;
    });
  }, [allocations, dateSet, destinationWorkItem, scope, targetPersonIds, selectedWorkItemScope, sourceFilter]);

  // Build map of existing allocations at destination for conflict detection
  // Key: "personId|date", value: allocation ID(s) that already have the destination workItemId
  const preview = useMemo(() => {
    if (candidates.length === 0 || !destinationWorkItem) {
      return { movedCount: 0, overwriteCount: 0, skipCount: 0, updateIds: [] as string[], deleteConflictIds: [] as string[] };
    }

    // Build index of ALL allocations by personId|date for conflict detection
    const allocsByCell = new Map<string, Allocation[]>();
    for (const a of allocations) {
      const key = `${a.personId}|${a.date}`;
      const arr = allocsByCell.get(key);
      if (arr) arr.push(a);
      else allocsByCell.set(key, [a]);
    }

    // Set of candidate IDs so we don't count them as their own conflicts
    const candidateIdSet = new Set(candidates.map((c) => c.id));

    const updateIds: string[] = [];
    const deleteConflictIds: string[] = [];
    let skipCount = 0;

    for (const candidate of candidates) {
      const key = `${candidate.personId}|${candidate.date}`;
      const cellAllocs = allocsByCell.get(key) || [];

      // Find existing allocations at this cell for the DESTINATION work item,
      // excluding the candidate itself
      const destConflicts = cellAllocs.filter(
        (a) => a.workItemId === destinationWorkItem && !candidateIdSet.has(a.id)
      );

      if (conflictMode === 'replace') {
        // Move the candidate, delete any existing destination allocations
        updateIds.push(candidate.id);
        for (const c of destConflicts) {
          deleteConflictIds.push(c.id);
        }
      } else {
        // Skip mode: skip if ANY allocation for destination work item exists at this cell
        if (destConflicts.length > 0) {
          skipCount++;
        } else {
          updateIds.push(candidate.id);
        }
      }
    }

    // Dedupe deleteConflictIds (same alloc could be counted multiple times if
    // multiple candidates target the same cell — unlikely but safe)
    const uniqueDeleteIds = [...new Set(deleteConflictIds)];

    return {
      movedCount: updateIds.length,
      overwriteCount: uniqueDeleteIds.length,
      skipCount,
      updateIds,
      deleteConflictIds: uniqueDeleteIds,
    };
  }, [candidates, allocations, destinationWorkItem, conflictMode]);

  const scopeReady = useMemo(() => {
    switch (scope) {
      case 'people': return selectedPeople.length > 0;
      case 'workItem': return !!selectedWorkItemScope;
      case 'pod': return !!selectedPod;
    }
  }, [scope, selectedPeople, selectedWorkItemScope, selectedPod]);

  const canApply = scopeReady && !!destinationWorkItem && preview.movedCount > 0;

  const handleApply = async () => {
    if (!canApply) return;
    await bulkReassign(preview.updateIds, destinationWorkItem, preview.deleteConflictIds);
    const msg = [`Moved ${preview.movedCount} assignment${preview.movedCount !== 1 ? 's' : ''}`];
    if (preview.overwriteCount > 0) msg.push(`overwrote ${preview.overwriteCount}`);
    if (preview.skipCount > 0) msg.push(`skipped ${preview.skipCount} conflicts`);
    setMessage(msg.join(', ') + '.');
  };

  return (
    <section className="edit-section">
      <h3>Bulk Reassign</h3>

      {/* Scope selector */}
      <div className="form-group">
        <label>Scope</label>
        <div className="bulk-unassign-scopes">
          <label className="radio-label">
            <input
              type="radio"
              name="reassign-scope"
              checked={scope === 'people'}
              onChange={() => setScope('people')}
            />
            People
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="reassign-scope"
              checked={scope === 'workItem'}
              onChange={() => setScope('workItem')}
            />
            Work Item
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="reassign-scope"
              checked={scope === 'pod'}
              onChange={() => setScope('pod')}
            />
            Pod
          </label>
        </div>
      </div>

      {/* Scope-specific inputs */}
      {scope === 'people' && (
        <div className="form-group">
          <label>People (multi-select)</label>
          <div className="people-checkboxes">
            {people.filter((p) => p.status === 'active').map((p) => (
              <label key={p.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(p.id)}
                  onChange={() => togglePerson(p.id)}
                />
                {p.name}
                {p.type === 'vendor' ? ' (V)' : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      {scope === 'workItem' && (
        <div className="form-group">
          <label>Source Work Item (moves all people assigned to it)</label>
          <select
            value={selectedWorkItemScope}
            onChange={(e) => setSelectedWorkItemScope(e.target.value)}
          >
            <option value="">-- Select Work Item --</option>
            {workItems.map((wi) => (
              <option key={wi.id} value={wi.id}>
                {getWorkItemLabel(wi)}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope === 'pod' && (
        <div className="form-group">
          <label>Pod (moves allocations for all people in pod)</label>
          <select
            value={selectedPod}
            onChange={(e) => setSelectedPod(e.target.value)}
          >
            <option value="">-- Select Pod --</option>
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date range */}
      <div className="form-row">
        <div className="form-group">
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={weekdaysOnly}
            onChange={(e) => setWeekdaysOnly(e.target.checked)}
          />
          Weekdays only
        </label>
      </div>

      {/* Optional source filter (people/pod scope only) */}
      {scope !== 'workItem' && (
        <div className="form-group">
          <label>Only reassign if currently assigned to (optional)</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">Any work item</option>
            {workItems.map((wi) => (
              <option key={wi.id} value={wi.id}>
                {getWorkItemLabel(wi)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Destination work item */}
      <div className="form-group">
        <label>Destination Work Item *</label>
        <select
          value={destinationWorkItem}
          onChange={(e) => setDestinationWorkItem(e.target.value)}
        >
          <option value="">-- Select Destination --</option>
          {workItems.map((wi) => (
            <option key={wi.id} value={wi.id}>
              {getWorkItemLabel(wi)}
            </option>
          ))}
        </select>
      </div>

      {/* Conflict mode */}
      <div className="form-group">
        <label>Conflict Mode</label>
        <div className="bulk-unassign-scopes">
          <label className="radio-label">
            <input
              type="radio"
              name="reassign-conflict"
              checked={conflictMode === 'replace'}
              onChange={() => setConflictMode('replace')}
            />
            Replace
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="reassign-conflict"
              checked={conflictMode === 'skip'}
              onChange={() => setConflictMode('skip')}
            />
            Skip conflicts
          </label>
        </div>
      </div>

      {/* Live preview */}
      <div className="bulk-unassign-preview">
        {scopeReady && destinationWorkItem ? (
          preview.movedCount > 0 || preview.skipCount > 0 ? (
            <div className="reassign-preview-lines">
              <span className="preview-count preview-count--info">
                Will move <strong>{preview.movedCount}</strong> assignment{preview.movedCount !== 1 ? 's' : ''}
              </span>
              {conflictMode === 'replace' && preview.overwriteCount > 0 && (
                <span className="preview-count preview-count--warn">
                  Will overwrite <strong>{preview.overwriteCount}</strong> existing
                </span>
              )}
              {conflictMode === 'skip' && preview.skipCount > 0 && (
                <span className="preview-count preview-count--skip">
                  Will skip <strong>{preview.skipCount}</strong> conflict{preview.skipCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ) : (
            <span className="preview-count preview-count--empty">
              {candidates.length === 0 ? 'No matching assignments found' : 'No assignments to move'}
            </span>
          )
        ) : (
          <span className="preview-count preview-count--empty">Select scope and destination above</span>
        )}
      </div>

      <button
        className="btn btn--primary"
        onClick={handleApply}
        disabled={!canApply}
      >
        Reassign
      </button>

      {message && <div className="form-message">{message}</div>}
    </section>
  );
}

/* ============================================
   QUICK ACTIONS (existing)
   ============================================ */

function QuickActions() {
  const people = useStore((s) => s.people);
  const clearAllocations = useStore((s) => s.clearAllocations);
  const duplicateScenario = useStore((s) => s.duplicateScenario);
  const currentScenarioId = useStore((s) => s.currentScenarioId);
  const setScenario = useStore((s) => s.setScenario);

  const [clearPerson, setClearPerson] = useState('');
  const [clearStart, setClearStart] = useState(toDateStr(today()));
  const [clearEnd, setClearEnd] = useState(toDateStr(addWeeks(today(), 1)));
  const [clearMessage, setClearMessage] = useState('');

  const [dupName, setDupName] = useState('');
  const [dupMessage, setDupMessage] = useState('');

  const handleClear = async () => {
    if (!clearPerson) {
      setClearMessage('Please select a person.');
      return;
    }
    await clearAllocations(clearPerson, clearStart, clearEnd);
    setClearMessage(
      `Cleared allocations for ${people.find((p) => p.id === clearPerson)?.name} from ${clearStart} to ${clearEnd}.`
    );
  };

  const handleDuplicate = async () => {
    if (!dupName.trim()) {
      setDupMessage('Please enter a scenario name.');
      return;
    }
    const newId = await duplicateScenario(currentScenarioId, dupName.trim());
    setScenario(newId);
    setDupMessage(`Scenario "${dupName.trim()}" created and activated.`);
    setDupName('');
  };

  return (
    <section className="edit-section">
      <h3>Quick Actions</h3>

      <div className="quick-action">
        <h4>Clear Allocations</h4>
        <div className="form-group">
          <label>Person</label>
          <select
            value={clearPerson}
            onChange={(e) => setClearPerson(e.target.value)}
          >
            <option value="">-- Select Person --</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>From</label>
            <input
              type="date"
              value={clearStart}
              onChange={(e) => setClearStart(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>To</label>
            <input
              type="date"
              value={clearEnd}
              onChange={(e) => setClearEnd(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn--danger" onClick={handleClear}>
          Clear
        </button>
        {clearMessage && <div className="form-message">{clearMessage}</div>}
      </div>

      <div className="quick-action">
        <h4>Duplicate Scenario</h4>
        <div className="form-group">
          <input
            type="text"
            placeholder="New scenario name"
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
          />
        </div>
        <button className="btn btn--primary" onClick={handleDuplicate}>
          Duplicate Current Scenario
        </button>
        {dupMessage && <div className="form-message">{dupMessage}</div>}
      </div>
    </section>
  );
}
