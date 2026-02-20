import { useState } from 'react';
import { useStore } from '../../store';

export function ScenarioSelector() {
  const scenarios = useStore((s) => s.scenarios);
  const currentScenarioId = useStore((s) => s.currentScenarioId);
  const setScenario = useStore((s) => s.setScenario);
  const duplicateScenario = useStore((s) => s.duplicateScenario);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
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

  return (
    <div className="scenario-selector">
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
        Export JSON
      </button>
      <button className="btn btn--sm" onClick={handleImport}>
        Import JSON
      </button>
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
