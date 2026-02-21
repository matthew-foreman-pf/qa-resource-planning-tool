import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { getWorkItemLabel } from '../../utils/helpers';

export function SelectionActionBar() {
  const editMode = useStore((s) => s.editMode);
  const selectedCells = useStore((s) => s.selectedCells);
  const workItems = useStore((s) => s.workItems);
  const batchAssign = useStore((s) => s.batchAssign);
  const batchClear = useStore((s) => s.batchClear);
  const clearSelection = useStore((s) => s.clearSelection);

  const [wiId, setWiId] = useState('');
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

  if (!editMode || selectedCells.size === 0) return null;

  const handleAssign = async () => {
    if (!wiId) return;
    await batchAssign(wiId);
    setMsg(`Assigned to ${selectedCells.size} cell(s)`);
    setWiId('');
    setSearch('');
    setTimeout(() => setMsg(''), 2500);
  };

  const handleClear = async () => {
    const count = selectedCells.size;
    await batchClear();
    setMsg(`Cleared ${count} cell(s)`);
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="selection-action-bar">
      <div className="selection-bar-left">
        <span className="selection-count">
          {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
        </span>
        <button className="btn btn--sm" onClick={clearSelection}>
          Deselect All
        </button>
      </div>

      <div className="selection-bar-center">
        <div className="selection-bar-assign">
          <input
            type="text"
            placeholder="Search work items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="selection-search-input"
          />
          <select
            value={wiId}
            onChange={(e) => setWiId(e.target.value)}
            className="selection-wi-select"
          >
            <option value="">-- Select work item --</option>
            {filteredWIs.map((wi) => (
              <option key={wi.id} value={wi.id}>
                {getWorkItemLabel(wi)}
              </option>
            ))}
          </select>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleAssign}
            disabled={!wiId}
          >
            Assign
          </button>
        </div>
        <button className="btn btn--danger btn--sm" onClick={handleClear}>
          Clear Assignments
        </button>
      </div>

      <div className="selection-bar-right">
        {msg && <span className="selection-bar-msg">{msg}</span>}
      </div>
    </div>
  );
}
