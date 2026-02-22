import { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../store';
import { getPodName } from '../../utils/helpers';
import type { PersonRole, PersonType } from '../../types';

export function PeopleScreen() {
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const archivePerson = useStore((s) => s.archivePerson);
  const restorePerson = useStore((s) => s.restorePerson);
  const openPersonDrawer = useStore((s) => s.openPersonDrawer);
  const openAddPersonDrawer = useStore((s) => s.openAddPersonDrawer);
  const batchUpdatePeopleHomePod = useStore((s) => s.batchUpdatePeopleHomePod);
  const batchUpdatePeopleLead = useStore((s) => s.batchUpdatePeopleLead);
  const currentUserId = useStore((s) => s.currentUserId);

  const currentUser = people.find((p) => p.id === currentUserId);
  const isEditor = currentUser?.role === 'qa_lead' || currentUser?.role === 'pod_lead';

  // Filters
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filterPod, setFilterPod] = useState('');
  const [filterRole, setFilterRole] = useState<'' | PersonRole>('');
  const [filterType, setFilterType] = useState<'' | PersonType>('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk home pod toolbar
  const [destinationPod, setDestinationPod] = useState('');
  const [updatePodLeadFilter, setUpdatePodLeadFilter] = useState(true);
  const [message, setMessage] = useState('');

  // Bulk assign lead toolbar
  const [destinationLead, setDestinationLead] = useState('');

  // Eligible leads for the lead dropdown
  const eligibleLeads = useMemo(
    () => people.filter((p) => (p.role === 'qa_lead' || p.role === 'pod_lead') && p.status === 'active'),
    [people]
  );

  // Filtered people list
  const filteredPeople = useMemo(() => {
    let list = people;

    // Archived filter
    if (!showArchived) {
      list = list.filter((p) => p.status !== 'archived');
    }

    // Pod filter
    if (filterPod) {
      list = list.filter((p) => p.homePodId === filterPod);
    }

    // Role filter
    if (filterRole) {
      list = list.filter((p) => p.role === filterRole);
    }

    // Type filter
    if (filterType) {
      list = list.filter((p) => p.type === filterType);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          (p.homePodId && getPodName(pods, p.homePodId).toLowerCase().includes(q))
      );
    }

    // Sort: active first, then by name
    return [...list].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [people, showArchived, filterPod, filterRole, filterType, search, pods]);

  // Set of visible IDs for "select all" logic
  const visibleIds = useMemo(
    () => new Set(filteredPeople.map((p) => p.id)),
    [filteredPeople]
  );

  // All filtered people selected?
  const allSelected = filteredPeople.length > 0 && filteredPeople.every((p) => selectedIds.has(p.id));

  const togglePerson = useCallback((personId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      // Deselect all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  }, [allSelected, visibleIds]);

  // Only count selected IDs that are still visible (in case filters changed)
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const id of selectedIds) {
      if (visibleIds.has(id)) count++;
    }
    return count;
  }, [selectedIds, visibleIds]);

  // Actual IDs to operate on (intersection of selected and visible)
  const effectiveSelectedIds = useMemo(() => {
    const ids: string[] = [];
    for (const id of selectedIds) {
      if (visibleIds.has(id)) ids.push(id);
    }
    return ids;
  }, [selectedIds, visibleIds]);

  const handleBulkUpdate = async () => {
    if (effectiveSelectedIds.length === 0 || !destinationPod) {
      setMessage('Please select people and a destination pod.');
      return;
    }
    await batchUpdatePeopleHomePod(effectiveSelectedIds, destinationPod, updatePodLeadFilter);
    const podName = pods.find((p) => p.id === destinationPod)?.name || destinationPod;
    setMessage(`Updated home pod to "${podName}" for ${effectiveSelectedIds.length} ${effectiveSelectedIds.length === 1 ? 'person' : 'people'}.`);
    setSelectedIds(new Set());
    // Auto-clear message after 4s
    setTimeout(() => setMessage(''), 4000);
  };

  const handleBulkAssignLead = async () => {
    if (effectiveSelectedIds.length === 0 || !destinationLead) {
      setMessage('Please select people and a lead.');
      return;
    }
    await batchUpdatePeopleLead(effectiveSelectedIds, destinationLead);
    const leadName = people.find((p) => p.id === destinationLead)?.name || destinationLead;
    setMessage(`Assigned lead "${leadName}" to ${effectiveSelectedIds.length} ${effectiveSelectedIds.length === 1 ? 'person' : 'people'}.`);
    setSelectedIds(new Set());
    setTimeout(() => setMessage(''), 4000);
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'qa_lead': return 'QA Lead';
      case 'pod_lead': return 'Pod Lead';
      case 'tester': return 'Tester';
      default: return role;
    }
  };

  return (
    <div className={`people-screen ${isEditor && selectedCount > 0 ? 'people-screen--has-selection' : ''}`}>
      <div className="people-header">
        <div>
          <h2>People</h2>
          <p className="screen-subtitle">
            Manage team members, roles, and pod assignments.
          </p>
        </div>
        {isEditor && (
          <button
            className="btn btn--primary btn--add-person"
            onClick={openAddPersonDrawer}
          >
            + Add Team Member
          </button>
        )}
      </div>

      {/* Toolbar: search + filters */}
      <div className="people-toolbar">
        <input
          type="text"
          className="people-search"
          placeholder="Search by name, role, type, or pod..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="people-filter-select"
          value={filterPod}
          onChange={(e) => setFilterPod(e.target.value)}
        >
          <option value="">All Pods</option>
          {pods.map((pod) => (
            <option key={pod.id} value={pod.id}>{pod.name}</option>
          ))}
        </select>
        <select
          className="people-filter-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as '' | PersonRole)}
        >
          <option value="">All Roles</option>
          <option value="qa_lead">QA Lead</option>
          <option value="pod_lead">Pod Lead</option>
          <option value="tester">Tester</option>
        </select>
        <select
          className="people-filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as '' | PersonType)}
        >
          <option value="">All Types</option>
          <option value="internal">Internal</option>
          <option value="vendor">Vendor</option>
        </select>
        <label className="toolbar-checkbox">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        <span className="people-count">
          {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Table */}
      <table className="people-table">
        <thead>
          <tr>
            {isEditor && (
              <th className="people-th-check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  title="Select all (filtered)"
                />
              </th>
            )}
            <th>Name</th>
            <th>Role</th>
            <th>Type</th>
            <th>Home Pod</th>
            <th>Lead</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredPeople.length === 0 ? (
            <tr>
              <td colSpan={isEditor ? 8 : 7} className="people-empty">
                No people found.
              </td>
            </tr>
          ) : (
            filteredPeople.map((person) => (
              <tr
                key={person.id}
                className={`${person.status === 'archived' ? 'people-row--archived' : ''} ${selectedIds.has(person.id) ? 'people-row--selected' : ''}`}
              >
                {isEditor && (
                  <td className="people-td-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(person.id)}
                      onChange={() => togglePerson(person.id)}
                    />
                  </td>
                )}
                <td className="people-cell-name">
                  <span className="people-name-text">{person.name}</span>
                </td>
                <td>{roleLabel(person.role)}</td>
                <td>
                  <span className={`people-type-badge people-type-badge--${person.type}`}>
                    {person.type === 'internal' ? 'Internal' : 'Vendor'}
                  </span>
                </td>
                <td>
                  {person.homePodId
                    ? getPodName(pods, person.homePodId)
                    : <span className="people-no-pod">--</span>}
                </td>
                <td>
                  {person.leadId
                    ? (people.find((p) => p.id === person.leadId)?.name || '--')
                    : <span className="people-no-pod">--</span>}
                </td>
                <td>
                  <span
                    className={`people-status-badge ${
                      person.status === 'active'
                        ? 'people-status-badge--active'
                        : 'people-status-badge--archived'
                    }`}
                  >
                    {person.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="people-cell-actions">
                  <button
                    className="btn btn--sm"
                    onClick={() => openPersonDrawer(person.id)}
                  >
                    Edit
                  </button>
                  {person.status === 'active' ? (
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive ${person.name}? They will be dimmed on the roster.`
                          )
                        ) {
                          archivePerson(person.id);
                        }
                      }}
                    >
                      Archive
                    </button>
                  ) : (
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() => restorePerson(person.id)}
                    >
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Sticky selection toolbar */}
      {isEditor && selectedCount > 0 && (
        <div className="people-selection-bar">
          <div className="people-selection-bar-left">
            <span className="people-selection-count">{selectedCount} selected</span>
            <button
              className="btn btn--sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
          <div className="people-selection-bar-center">
            {/* Assign Home Pod action */}
            <select
              className="people-selection-pod-select"
              value={destinationPod}
              onChange={(e) => setDestinationPod(e.target.value)}
            >
              <option value="">-- Destination Pod --</option>
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>{pod.name}</option>
              ))}
            </select>
            <label className="toolbar-checkbox">
              <input
                type="checkbox"
                checked={updatePodLeadFilter}
                onChange={(e) => setUpdatePodLeadFilter(e.target.checked)}
              />
              Set pod_lead default filter
            </label>
            <button
              className="btn btn--primary btn--sm"
              onClick={handleBulkUpdate}
              disabled={!destinationPod}
            >
              Update Home Pod
            </button>

            <span className="people-selection-divider" />

            {/* Assign Lead action */}
            <select
              className="people-selection-pod-select"
              value={destinationLead}
              onChange={(e) => setDestinationLead(e.target.value)}
            >
              <option value="">-- Assign Lead --</option>
              {eligibleLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} ({lead.role === 'qa_lead' ? 'QA Lead' : 'Pod Lead'})
                </option>
              ))}
            </select>
            <button
              className="btn btn--primary btn--sm"
              onClick={handleBulkAssignLead}
              disabled={!destinationLead}
            >
              Assign Lead
            </button>

            <span className="people-selection-preview">
              Will update <strong>{selectedCount}</strong> {selectedCount === 1 ? 'person' : 'people'}
            </span>
            {selectedCount > 5 && (
              <span className="people-selection-hint">
                This will regroup the roster and update cross-pod indicators.
              </span>
            )}
          </div>
          {message && (
            <span className="people-selection-msg">{message}</span>
          )}
        </div>
      )}
    </div>
  );
}
