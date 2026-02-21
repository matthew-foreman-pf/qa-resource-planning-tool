import { RosterGrid } from './RosterGrid';
import { DayAssignmentDrawer } from './DayAssignmentDrawer';
import { SelectionActionBar } from './SelectionActionBar';

export function RosterScreen() {
  return (
    <div className="roster-screen">
      <h2>Roster</h2>
      <p className="screen-subtitle">12-week day-level view of all QA resources</p>
      <RosterGrid />
      <SelectionActionBar />
      <DayAssignmentDrawer />
    </div>
  );
}
