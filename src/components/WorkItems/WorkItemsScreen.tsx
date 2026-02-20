import { useState } from 'react';
import { useStore } from '../../store';
import { getWorkItemLabel, getPodName } from '../../utils/helpers';
import { formatDate, fromDateStr } from '../../utils/dates';
import type { WorkItem, WorkItemType } from '../../types';

export function WorkItemsScreen() {
  const workItems = useStore((s) => s.workItems);
  const pods = useStore((s) => s.pods);
  const addWorkItem = useStore((s) => s.addWorkItem);
  const updateWorkItem = useStore((s) => s.updateWorkItem);
  const deleteWorkItem = useStore((s) => s.deleteWorkItem);

  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [creating, setCreating] = useState(false);

  const emptyWi: WorkItem = {
    id: '',
    type: 'feature',
    name: '',
    podId: pods[0]?.id || '',
    startDate: '',
    endDate: '',
    requiredMinDaysPerWeek: 1,
    releaseDate: '',
    notes: '',
  };

  const handleCreate = () => {
    setEditing({ ...emptyWi, id: crypto.randomUUID() });
    setCreating(true);
  };

  const handleEdit = (wi: WorkItem) => {
    setEditing({ ...wi });
    setCreating(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name || !editing.startDate || !editing.endDate || !editing.podId) return;

    if (creating) {
      await addWorkItem(editing);
    } else {
      await updateWorkItem(editing);
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this work item and all its allocations?')) {
      await deleteWorkItem(id);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <div className="work-items-screen">
      <h2>Work Items</h2>
      <p className="screen-subtitle">Manage work items for the current scenario</p>

      <button className="btn btn--primary" onClick={handleCreate}>
        + New Work Item
      </button>

      {editing && (
        <div className="wi-form">
          <h3>{creating ? 'Create Work Item' : 'Edit Work Item'}</h3>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select
                value={editing.type}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    type: e.target.value as WorkItemType,
                  })
                }
              >
                <option value="feature">Feature</option>
                <option value="initiative">Initiative</option>
              </select>
            </div>
            <div className="form-group">
              <label>Pod</label>
              <select
                value={editing.podId}
                onChange={(e) =>
                  setEditing({ ...editing, podId: e.target.value })
                }
              >
                {pods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={editing.startDate}
                onChange={(e) =>
                  setEditing({ ...editing, startDate: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={editing.endDate}
                onChange={(e) =>
                  setEditing({ ...editing, endDate: e.target.value })
                }
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Required Min Days/Week</label>
              <input
                type="number"
                min={1}
                max={5}
                value={editing.requiredMinDaysPerWeek}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    requiredMinDaysPerWeek: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Release Date (optional)</label>
              <input
                type="date"
                value={editing.releaseDate || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    releaseDate: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={editing.notes || ''}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  notes: e.target.value || undefined,
                })
              }
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn--primary" onClick={handleSave}>
              {creating ? 'Create' : 'Save'}
            </button>
            <button className="btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="wi-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Pod</th>
            <th>Start</th>
            <th>End</th>
            <th>Req Days/Wk</th>
            <th>Release</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workItems.map((wi) => (
            <tr key={wi.id}>
              <td>{wi.name}</td>
              <td>{wi.type}</td>
              <td>{getPodName(pods, wi.podId)}</td>
              <td>{formatDate(fromDateStr(wi.startDate))}</td>
              <td>{formatDate(fromDateStr(wi.endDate))}</td>
              <td>{wi.requiredMinDaysPerWeek}</td>
              <td>
                {wi.releaseDate
                  ? formatDate(fromDateStr(wi.releaseDate))
                  : '-'}
              </td>
              <td>
                <button
                  className="btn btn--sm"
                  onClick={() => handleEdit(wi)}
                >
                  Edit
                </button>
                <button
                  className="btn btn--sm btn--danger"
                  onClick={() => handleDelete(wi.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
