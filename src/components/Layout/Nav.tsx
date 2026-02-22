import { useStore } from '../../store';

function Logo() {
  return (
    <div className="nav-logo" onClick={() => window.location.reload()}>
      <svg
        className="nav-logo-icon"
        width="36"
        height="36"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Grid/calendar base */}
        <rect x="2" y="4" width="24" height="20" rx="3" fill="#44444E" stroke="#715A5A" strokeWidth="1.5" />
        {/* Top bar */}
        <rect x="2" y="4" width="24" height="6" rx="3" fill="#715A5A" />
        {/* Grid lines */}
        <line x1="10" y1="10" x2="10" y2="24" stroke="#55555F" strokeWidth="0.75" />
        <line x1="18" y1="10" x2="18" y2="24" stroke="#55555F" strokeWidth="0.75" />
        <line x1="2" y1="15" x2="26" y2="15" stroke="#55555F" strokeWidth="0.75" />
        <line x1="2" y1="20" x2="26" y2="20" stroke="#55555F" strokeWidth="0.75" />
        {/* Check mark */}
        <path d="M11 17.5L13.5 20L18 14" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Calendar pins */}
        <rect x="7" y="2" width="2" height="4" rx="1" fill="#D3DAD9" />
        <rect x="19" y="2" width="2" height="4" rx="1" fill="#D3DAD9" />
      </svg>
      <div className="nav-logo-text">
        <span className="nav-logo-title">Wordscapes</span>
        <span className="nav-logo-subtitle">QA Planner</span>
      </div>
    </div>
  );
}

export function Nav() {
  const currentScreen = useStore((s) => s.currentScreen);
  const setScreen = useStore((s) => s.setScreen);

  const tabs: { key: typeof currentScreen; label: string }[] = [
    { key: 'roster', label: 'Roster' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'editPlan', label: 'Edit Plan' },
    { key: 'workItems', label: 'Work Items' },
    { key: 'people', label: 'People' },
  ];

  return (
    <nav className="nav">
      <Logo />
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
      <button
        className={`nav-settings-btn ${currentScreen === 'settings' ? 'nav-settings-btn--active' : ''}`}
        onClick={() => setScreen('settings')}
        title="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </nav>
  );
}
