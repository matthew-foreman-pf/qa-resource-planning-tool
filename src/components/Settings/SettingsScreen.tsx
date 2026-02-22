import { useState } from 'react';
import { useStore } from '../../store';
import { isCloudEnabled } from '../../db';

export function SettingsScreen() {
  const resetData = useStore((s) => s.resetData);
  const inviteTeamMember = useStore((s) => s.inviteTeamMember);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const handleReset = async () => {
    setResetting(true);
    await resetData();
    setResetting(false);
    setShowConfirm(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await inviteTeamMember(inviteEmail.trim());
      setInviteMsg(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
    } catch {
      setInviteMsg('Failed to send invitation. Please try again.');
    }
    setInviting(false);
  };

  return (
    <div className="settings-screen">
      <h2>Settings</h2>
      <p className="screen-subtitle">Application configuration and data management</p>

      {isCloudEnabled && (
        <section className="settings-section">
          <h3>Team Members</h3>

          <div className="settings-card">
            <div className="settings-card-info">
              <h4>Invite Team Member</h4>
              <p>
                Invite a team member by email. They will receive a login link
                and gain access to all shared planning data.
              </p>
            </div>
            <div className="settings-card-action">
              <div className="settings-invite-row">
                <input
                  type="email"
                  className="settings-invite-input"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  disabled={inviting}
                />
                <button
                  className="btn btn--primary"
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
              {inviteMsg && (
                <p className="settings-invite-msg">{inviteMsg}</p>
              )}
            </div>
          </div>
        </section>
      )}

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
