import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Nav } from './components/Layout/Nav';
import { ScenarioSelector } from './components/Scenarios/ScenarioSelector';
import { RosterScreen } from './components/Roster/RosterScreen';
import { DashboardScreen } from './components/Dashboard/DashboardScreen';
import { EditPlanScreen } from './components/EditPlan/EditPlanScreen';
import { WorkItemsScreen } from './components/WorkItems/WorkItemsScreen';

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
        <p>Loading QA Resource Planner...</p>
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
      </main>
    </div>
  );
}
