import { useState } from 'react';
import { useStore } from '../../store';

export function ScenarioSelector() {
  const scenarios = useStore((s) => s.scenarios);
  const currentScenarioId = useStore((s) => s.currentScenarioId);
  const setScenario = useStore((s) => s.setScenario);
  const duplicateScenario = useStore((s) => s.duplicateScenario);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const showArchivedPeople = useStore((s) => s.showArchivedPeople);
  const setShowArchivedPeople = useStore((s) => s.setShowArchivedPeople);
  const pods = useStore((s) => s.pods);
  const podFilterIds = useStore((s) => s.podFilterIds);
  const setPodFilterIds = useStore((s) => s.setPodFilterIds);
  const editMode = useStore((s) => s.editMode);
  const setEditMode = useStore((s) => s.setEditMode);
  const currentScreen = useStore((s) => s.currentScreen);

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleDuplicate = async () => {
    if (!newName.trim()) return;
    const newId = await duplicateScenario(currentScenarioId, newName.trim());
    setScenario(newId);
    setNewName('');
    setShowDuplicate(false);
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qa-resource-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
    };
    input.click();
  };

  const handlePodFilterChange = (podId: string) => {
    if (podFilterIds.includes(podId)) {
      setPodFilterIds(podFilterIds.filter((id) => id !== podId));
    } else {
      setPodFilterIds([...podFilterIds, podId]);
    }
  };

  const clearPodFilter = () => {
    setPodFilterIds([]);
  };

  return (
    <div className="scenario-selector">
      <div className="toolbar-row">
        <div className="toolbar-group">
          <label>Scenario:</label>
          <select
            value={currentScenarioId}
            onChange={(e) => setScenario(e.target.value)}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isBase ? ' (Base)' : ''}
              </option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={() => setShowDuplicate(!showDuplicate)}>
            Duplicate
          </button>
          <button className="btn btn--sm" onClick={handleExport}>
            Export
          </button>
          <button className="btn btn--sm" onClick={handleImport}>
            Import
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <label className="toolbar-checkbox">
            <input
              type="checkbox"
              checked={showArchivedPeople}
              onChange={(e) => setShowArchivedPeople(e.target.checked)}
            />
            Show Archived
          </label>
        </div>

        {currentScreen === 'roster' && (
          <>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <button
                className={`btn btn--sm ${editMode ? 'btn--edit-active' : ''}`}
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? '✓ Edit Mode' : 'Edit Mode'}
              </button>
            </div>
          </>
        )}

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <label>Pods:</label>
          <div className="pod-filter-chips">
            {podFilterIds.length === 0 ? (
              <span className="pod-chip pod-chip--active">All</span>
            ) : (
              <span className="pod-chip" onClick={clearPodFilter}>All</span>
            )}
            {pods.map((pod) => (
              <span
                key={pod.id}
                className={`pod-chip ${podFilterIds.includes(pod.id) ? 'pod-chip--active' : ''}`}
                onClick={() => handlePodFilterChange(pod.id)}
              >
                {pod.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showDuplicate && (
        <div className="scenario-duplicate-form">
          <input
            type="text"
            placeholder="New scenario name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDuplicate()}
          />
          <button className="btn btn--sm btn--primary" onClick={handleDuplicate}>
            Create
          </button>
          <button className="btn btn--sm" onClick={() => setShowDuplicate(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
