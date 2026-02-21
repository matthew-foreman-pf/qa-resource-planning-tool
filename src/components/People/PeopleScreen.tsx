import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { getPodName } from '../../utils/helpers';

export function PeopleScreen() {
  const people = useStore((s) => s.people);
  const pods = useStore((s) => s.pods);
  const showArchivedPeople = useStore((s) => s.showArchivedPeople);
  const archivePerson = useStore((s) => s.archivePerson);
  const restorePerson = useStore((s) => s.restorePerson);
  const openPersonDrawer = useStore((s) => s.openPersonDrawer);
  const openAddPersonDrawer = useStore((s) => s.openAddPersonDrawer);
  const currentUserId = useStore((s) => s.currentUserId);

  const currentUser = people.find((p) => p.id === currentUserId);
  const isEditor = currentUser?.role === 'qa_lead' || currentUser?.role === 'pod_lead';

  const [search, setSearch] = useState('');

  const filteredPeople = useMemo(() => {
    let list = people;

    if (!showArchivedPeople) {
      list = list.filter((p) => p.status !== 'archived');
    }

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
  }, [people, showArchivedPeople, search, pods]);

  const roleLabel = (role: string) => {
    switch (role) {
      case 'qa_lead':
        return 'QA Lead';
      case 'pod_lead':
        return 'Pod Lead';
      case 'tester':
        return 'Tester';
      default:
        return role;
    }
  };

  return (
    <div className="people-screen">
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

      <div className="people-toolbar">
        <input
          type="text"
          className="people-search"
          placeholder="Search by name, role, type, or pod..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="people-count">
          {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      <table className="people-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Type</th>
            <th>Home Pod</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredPeople.length === 0 ? (
            <tr>
              <td colSpan={6} className="people-empty">
                No people found.
              </td>
            </tr>
          ) : (
            filteredPeople.map((person) => (
              <tr
                key={person.id}
                className={person.status === 'archived' ? 'people-row--archived' : ''}
              >
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
    </div>
  );
}
