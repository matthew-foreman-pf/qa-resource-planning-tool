import { useState } from 'react';
import { useStore } from '../../store';

export function SettingsScreen() {
  const resetData = useStore((s) => s.resetData);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetData();
    setResetting(false);
    setShowConfirm(false);
  };

  return (
    <div className="settings-screen">
      <h2>Settings</h2>
      <p className="screen-subtitle">Application configuration and data management</p>

      <section className="settings-section">
        <h3>Data Management</h3>

        <div className="settings-card">
          <div className="settings-card-info">
            <h4>Reset to Seed Data</h4>
            <p>
              Clear all current data (people, work items, allocations, scenarios, time off)
              and re-initialize the database with fresh seed data. This cannot be undone.
            </p>
          </div>
          <div className="settings-card-action">
            {!showConfirm ? (
              <button
                className="btn btn--danger"
                onClick={() => setShowConfirm(true)}
              >
                Reset Data
              </button>
            ) : (
              <div className="settings-confirm">
                <p className="settings-confirm-msg">
                  Are you sure? All current data will be permanently deleted and replaced with seed data.
                </p>
                <div className="settings-confirm-actions">
                  <button
                    className="btn btn--danger"
                    onClick={handleReset}
                    disabled={resetting}
                  >
                    {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
                  </button>
                  <button
                    className="btn"
                    onClick={() => setShowConfirm(false)}
                    disabled={resetting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
