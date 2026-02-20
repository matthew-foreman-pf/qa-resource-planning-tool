import { useState } from 'react';
import { useStore } from '../../store';
import { getWeekdaysInRangeStr, toDateStr, today } from '../../utils/dates';
import { getWorkItemLabel } from '../../utils/helpers';
import { addWeeks } from 'date-fns';

export function EditPlanScreen() {
  return (
    <div className="edit-plan-screen">
      <h2>Edit Plan</h2>
      <p className="screen-subtitle">Bulk assignment and quick actions for editors</p>
      <div className="edit-plan-sections">
        <BulkAssignmentForm />
        <QuickActions />
      </div>
    </div>
  );
}

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
