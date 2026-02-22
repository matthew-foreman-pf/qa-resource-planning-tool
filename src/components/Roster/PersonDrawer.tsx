import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { getWorkItemLabel, getPodName } from '../../utils/helpers';
import { getPlanningWeeks, toDateStr, getWeekdaysInRangeStr } from '../../utils/dates';
import type { PersonRole, PersonType, Allocation } from '../../types';

export function PersonDrawer() {
  const personDrawerOpen = useStore((s) => s.personDrawerOpen);
  const selectedPersonId = useStore((s) => s.selectedPersonId);
  const closePersonDrawer = useStore((s) => s.closePersonDrawer);
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const workItems = useStore((s) => s.workItems);
  const updatePerson = useStore((s) => s.updatePerson);
  const archivePerson = useStore((s) => s.archivePerson);
  const restorePerson = useStore((s) => s.restorePerson);
  const addAllocations = useStore((s) => s.addAllocations);
  const clearAllocations = useStore((s) => s.clearAllocations);
  const copyWeekAllocations = useStore((s) => s.copyWeekAllocations);

  if (!personDrawerOpen || !selectedPersonId) return null;

  const person = people.find((p) => p.id === selectedPersonId);
  if (!person) return null;

  return (
    <div className="person-drawer-overlay" onClick={closePersonDrawer}>
      <div className="person-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Edit Person</h3>
          <button className="btn btn--sm" onClick={closePersonDrawer}>
            &times;
          </button>
        </div>
        <div className="drawer-body">
          <ProfileSection person={person} pods={pods} updatePerson={updatePerson} />
          <ArchiveSection
            person={person}
            archivePerson={archivePerson}
            restorePerson={restorePerson}
          />
          <hr className="drawer-divider" />
          <h4 className="drawer-section-title">Schedule Actions</h4>
          <BulkAssignSection
            personId={person.id}
            workItems={workItems}
            addAllocations={addAllocations}
          />
          <ClearAssignmentsSection
            personId={person.id}
            clearAllocations={clearAllocations}
          />
          <CopyWeekSection
            personId={person.id}
            copyWeekAllocations={copyWeekAllocations}
          />
        </div>
      </div>
    </div>
  );
}

/* ---- Profile Section ---- */

function ProfileSection({
  person,
  pods,
  updatePerson,
}: {
  person: ReturnType<typeof useStore.getState>['people'][0];
  pods: ReturnType<typeof useStore.getState>['pods'];
  updatePerson: ReturnType<typeof useStore.getState>['updatePerson'];
}) {
  const people = useStore((s) => s.people);
  const eligibleLeads = useMemo(
    () => people.filter((p) => (p.role === 'qa_lead' || p.role === 'pod_lead') && p.status === 'active'),
    [people]
  );

  const [name, setName] = useState(person.name);
  const [role, setRole] = useState<PersonRole>(person.role);
  const [type, setType] = useState<PersonType>(person.type);
  const [homePodId, setHomePodId] = useState(person.homePodId || '');
  const [leadId, setLeadId] = useState(person.leadId || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updatePerson({
      ...person,
      name: name.trim() || person.name,
      role,
      type,
      homePodId: homePodId || undefined,
      leadId: leadId || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="drawer-section">
      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as PersonRole)}>
            <option value="qa_lead">QA Lead</option>
            <option value="pod_lead">Pod Lead</option>
            <option value="tester">Tester</option>
          </select>
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as PersonType)}>
            <option value="internal">Internal</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Home Pod</label>
        <select value={homePodId} onChange={(e) => setHomePodId(e.target.value)}>
          <option value="">None</option>
          {pods.map((pod) => (
            <option key={pod.id} value={pod.id}>
              {pod.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Lead</label>
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          <option value="">None</option>
          {eligibleLeads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name} ({lead.role === 'qa_lead' ? 'QA Lead' : 'Pod Lead'})
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button className="btn btn--primary btn--sm" onClick={handleSave}>
          Save Changes
        </button>
        {saved && <span className="drawer-saved-msg">Saved!</span>}
      </div>
    </div>
  );
}

/* ---- Archive Section ---- */

function ArchiveSection({
  person,
  archivePerson,
  restorePerson,
}: {
  person: ReturnType<typeof useStore.getState>['people'][0];
  archivePerson: (id: string) => Promise<void>;
  restorePerson: (id: string) => Promise<void>;
}) {
  const isArchived = person.status === 'archived';

  return (
    <div className="drawer-section">
      {isArchived ? (
        <div className="drawer-archive-row">
          <span className="side-panel-badge badge--neutral">
            Archived {person.archivedAt ? `on ${person.archivedAt}` : ''}
          </span>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => restorePerson(person.id)}
          >
            Restore
          </button>
        </div>
      ) : (
        <button
          className="btn btn--danger btn--sm"
          onClick={() => {
            if (window.confirm(`Archive ${person.name}? They will be dimmed on the roster.`)) {
              archivePerson(person.id);
            }
          }}
        >
          Archive Person
        </button>
      )}
    </div>
  );
}

/* ---- Bulk Assign Section ---- */

function BulkAssignSection({
  personId,
  workItems,
  addAllocations,
}: {
  personId: string;
  workItems: ReturnType<typeof useStore.getState>['workItems'];
  addAllocations: ReturnType<typeof useStore.getState>['addAllocations'];
}) {
  const [wiId, setWiId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const filteredWIs = useMemo(() => {
    if (!search) return workItems;
    const q = search.toLowerCase();
    return workItems.filter(
      (wi) =>
        wi.name.toLowerCase().includes(q) ||
        getWorkItemLabel(wi).toLowerCase().includes(q)
    );
  }, [workItems, search]);

  const handleApply = async () => {
    if (!wiId || !startDate || !endDate) return;
    const dates = weekdaysOnly
      ? getWeekdaysInRangeStr(startDate, endDate)
      : (() => {
          // all days in range
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
      workItemId: wiId,
      date,
      days: 1,
    }));

    if (allocs.length > 0) {
      await addAllocations(allocs);
      setMsg(`Created ${allocs.length} allocation(s)`);
      setTimeout(() => setMsg(''), 2500);
    }
  };

  return (
    <div className="drawer-action-block">
      <h5>Bulk Assign</h5>
      <div className="form-group">
        <label>Work Item</label>
        <input
          type="text"
          placeholder="Search work items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="drawer-search-input"
        />
        <select
          value={wiId}
          onChange={(e) => setWiId(e.target.value)}
          size={Math.min(5, filteredWIs.length + 1)}
          className="drawer-wi-select"
        >
          <option value="">-- Select --</option>
          {filteredWIs.map((wi) => (
            <option key={wi.id} value={wi.id}>
              {getWorkItemLabel(wi)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>End</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <label className="toolbar-checkbox" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={weekdaysOnly}
          onChange={(e) => setWeekdaysOnly(e.target.checked)}
        />
        Weekdays only
      </label>
      <div className="form-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleApply}
          disabled={!wiId || !startDate || !endDate}
        >
          Apply
        </button>
        {msg && <span className="drawer-saved-msg">{msg}</span>}
      </div>
    </div>
  );
}

/* ---- Clear Assignments Section ---- */

function ClearAssignmentsSection({
  personId,
  clearAllocations,
}: {
  personId: string;
  clearAllocations: ReturnType<typeof useStore.getState>['clearAllocations'];
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [msg, setMsg] = useState('');

  const handleApply = async () => {
    if (!startDate || !endDate) return;
    await clearAllocations(personId, startDate, endDate);
    setMsg('Cleared!');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="drawer-action-block">
      <h5>Clear Assignments</h5>
      <div className="form-row">
        <div className="form-group">
          <label>Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>End</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="form-actions">
        <button
          className="btn btn--danger btn--sm"
          onClick={handleApply}
          disabled={!startDate || !endDate}
        >
          Clear
        </button>
        {msg && <span className="drawer-saved-msg">{msg}</span>}
      </div>
    </div>
  );
}

/* ---- Copy Week Section ---- */

function CopyWeekSection({
  personId,
  copyWeekAllocations,
}: {
  personId: string;
  copyWeekAllocations: ReturnType<typeof useStore.getState>['copyWeekAllocations'];
}) {
  const weeks = useMemo(() => getPlanningWeeks(12), []);
  const [sourceWeek, setSourceWeek] = useState('');
  const [targetWeek, setTargetWeek] = useState('');
  const [msg, setMsg] = useState('');

  const handleApply = async () => {
    if (!sourceWeek || !targetWeek || sourceWeek === targetWeek) return;
    await copyWeekAllocations(personId, sourceWeek, targetWeek);
    setMsg('Copied!');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="drawer-action-block">
      <h5>Copy Week</h5>
      <div className="form-row">
        <div className="form-group">
          <label>Source Week</label>
          <select value={sourceWeek} onChange={(e) => setSourceWeek(e.target.value)}>
            <option value="">-- Select --</option>
            {weeks.map((w) => (
              <option key={w.weekStartStr} value={w.weekStartStr}>
                {w.weekLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Target Week</label>
          <select value={targetWeek} onChange={(e) => setTargetWeek(e.target.value)}>
            <option value="">-- Select --</option>
            {weeks.map((w) => (
              <option key={w.weekStartStr} value={w.weekStartStr}>
                {w.weekLabel}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleApply}
          disabled={!sourceWeek || !targetWeek || sourceWeek === targetWeek}
        >
          Copy
        </button>
        {msg && <span className="drawer-saved-msg">{msg}</span>}
      </div>
    </div>
  );
}
