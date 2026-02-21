import { useState } from 'react';
import { useStore } from '../../store';
import type { PersonRole, PersonType } from '../../types';

export function AddPersonDrawer() {
  const addPersonDrawerOpen = useStore((s) => s.addPersonDrawerOpen);
  const closeAddPersonDrawer = useStore((s) => s.closeAddPersonDrawer);
  const addPerson = useStore((s) => s.addPerson);
  const pods = useStore((s) => s.pods);

  const [name, setName] = useState('');
  const [role, setRole] = useState<PersonRole>('tester');
  const [type, setType] = useState<PersonType>('vendor');
  const [homePodId, setHomePodId] = useState('');
  const [weeklyCapacityDays, setWeeklyCapacityDays] = useState(5);
  const [error, setError] = useState('');

  if (!addPersonDrawerOpen) return null;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (!homePodId) {
      setError('Home pod is required.');
      return;
    }

    setError('');

    const person = {
      id: crypto.randomUUID(),
      name: trimmedName,
      role,
      type,
      homePodId: homePodId || undefined,
      weeklyCapacityDays,
      status: 'active' as const,
      ...(role === 'pod_lead' && homePodId
        ? { defaultPodFilterIds: [homePodId] }
        : {}),
    };

    await addPerson(person);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setRole('tester');
    setType('vendor');
    setHomePodId('');
    setWeeklyCapacityDays(5);
    setError('');
    closeAddPersonDrawer();
  };

  return (
    <div className="person-drawer-overlay" onClick={handleClose}>
      <div className="person-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Add Team Member</h3>
          <button className="btn btn--sm" onClick={handleClose}>
            &times;
          </button>
        </div>
        <div className="drawer-body">
          <div className="drawer-section">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Role *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as PersonRole)}>
                  <option value="tester">Tester</option>
                  <option value="pod_lead">Pod Lead</option>
                  <option value="qa_lead">QA Lead</option>
                </select>
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select value={type} onChange={(e) => setType(e.target.value as PersonType)}>
                  <option value="vendor">Vendor</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Home Pod *</label>
              <select value={homePodId} onChange={(e) => setHomePodId(e.target.value)}>
                <option value="">-- Select Pod --</option>
                {pods.map((pod) => (
                  <option key={pod.id} value={pod.id}>
                    {pod.name}
                  </option>
                ))}
              </select>
              {!homePodId && (
                <span className="add-person-hint">Required for all team members</span>
              )}
            </div>

            <div className="form-group">
              <label>Weekly Capacity (days)</label>
              <input
                type="number"
                min={1}
                max={7}
                step={1}
                value={weeklyCapacityDays}
                onChange={(e) => setWeeklyCapacityDays(Number(e.target.value))}
              />
            </div>

            {error && (
              <div className="add-person-error">{error}</div>
            )}

            <div className="form-actions">
              <button className="btn btn--primary btn--sm" onClick={handleSubmit}>
                Add Person
              </button>
              <button className="btn btn--sm" onClick={handleClose}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
