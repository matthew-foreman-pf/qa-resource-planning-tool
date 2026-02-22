import { useEffect, useState } from 'react';
import { useStore } from './store';
import { isCloudEnabled } from './db';
import { Nav } from './components/Layout/Nav';
import { ScenarioSelector } from './components/Scenarios/ScenarioSelector';
import { RosterScreen } from './components/Roster/RosterScreen';
import { DashboardScreen } from './components/Dashboard/DashboardScreen';
import { EditPlanScreen } from './components/EditPlan/EditPlanScreen';
import { WorkItemsScreen } from './components/WorkItems/WorkItemsScreen';
import { PeopleScreen } from './components/People/PeopleScreen';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { AddPersonDrawer } from './components/Roster/AddPersonDrawer';
import { PersonDrawer } from './components/Roster/PersonDrawer';

export default function App() {
  const initialize = useStore((s) => s.initialize);
  const currentScreen = useStore((s) => s.currentScreen);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initialize().then(() => setReady(true));
  }, [initialize]);

  if (!ready) {
    return (
      <div className="loading">
        <p>{isCloudEnabled ? 'Signing in and syncing...' : 'Loading QA Resource Planner...'}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Nav />
      <div className="toolbar">
        <ScenarioSelector />
      </div>
      <main className="main-content">
        {currentScreen === 'roster' && <RosterScreen />}
        {currentScreen === 'dashboard' && <DashboardScreen />}
        {currentScreen === 'editPlan' && <EditPlanScreen />}
        {currentScreen === 'workItems' && <WorkItemsScreen />}
        {currentScreen === 'people' && <PeopleScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
      </main>
      <PersonDrawer />
      <AddPersonDrawer />
    </div>
  );
}
