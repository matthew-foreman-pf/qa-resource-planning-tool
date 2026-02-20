import { RosterGrid } from './RosterGrid';
import { SidePanel } from './SidePanel';

export function RosterScreen() {
  return (
    <div className="roster-screen">
      <h2>Roster</h2>
      <p className="screen-subtitle">12-week day-level view of all QA resources</p>
      <div className="roster-layout">
        <RosterGrid />
        <SidePanel />
      </div>
    </div>
  );
}
