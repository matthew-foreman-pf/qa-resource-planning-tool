import { useStore } from '../../store';

export function Nav() {
  const currentScreen = useStore((s) => s.currentScreen);
  const setScreen = useStore((s) => s.setScreen);

  const tabs: { key: typeof currentScreen; label: string }[] = [
    { key: 'roster', label: 'Roster' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'editPlan', label: 'Edit Plan' },
    { key: 'workItems', label: 'Work Items' },
  ];

  return (
    <nav className="nav">
      <div className="nav-brand">QA Resource Planner</div>
      <div className="nav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`nav-tab ${currentScreen === tab.key ? 'nav-tab--active' : ''}`}
            onClick={() => setScreen(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
