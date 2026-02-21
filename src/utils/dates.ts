import {
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isWeekend,
  isBefore,
  isAfter,
  isSameDay,
  parseISO,
  addWeeks,
  startOfDay,
} from 'date-fns';

export function today(): Date {
  return startOfDay(new Date());
}

export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function fromDateStr(s: string): Date {
  return parseISO(s);
}

export function getWeekdaysInRange(start: Date, end: Date): Date[] {
  if (isAfter(start, end)) return [];
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d));
}

export function getWeekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 }); // Monday
}

export function getWeekEnd(d: Date): Date {
  return endOfWeek(d, { weekStartsOn: 1 }); // Sunday
}

export interface WeekInfo {
  weekStart: Date;
  weekStartStr: string;
  weekLabel: string;
  weekdays: Date[];
}

export function getPlanningWeeks(numWeeks: number = 12): WeekInfo[] {
  const t = today();
  const planStart = getWeekStart(t);
  const weeks: WeekInfo[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const ws = addWeeks(planStart, i);
    const we = getWeekEnd(ws);
    const weekdays = getWeekdaysInRange(
      i === 0 && isAfter(t, ws) ? t : ws,
      we
    ).filter((d) => !isBefore(d, t));

    // For the actual grid, always show full Mon-Fri
    const fullWeekdays = eachDayOfInterval({ start: ws, end: we }).filter(
      (d) => !isWeekend(d)
    );

    weeks.push({
      weekStart: ws,
      weekStartStr: toDateStr(ws),
      weekLabel: `Week of ${format(ws, 'MMM d')}`,
      weekdays: fullWeekdays,
    });
  }

  return weeks;
}

export function isDateInRange(
  dateStr: string,
  startStr: string,
  endStr: string
): boolean {
  const d = fromDateStr(dateStr);
  const s = fromDateStr(startStr);
  const e = fromDateStr(endStr);
  return (isSameDay(d, s) || isAfter(d, s)) && (isSameDay(d, e) || isBefore(d, e));
}

export function formatDate(d: Date): string {
  return format(d, 'MMM d');
}

export function formatDateFull(d: Date): string {
  return format(d, 'MMM d, yyyy');
}

export function formatDayHeader(d: Date): string {
  return format(d, 'EEE MMM d');
}

export function getWeekdaysInRangeStr(
  startStr: string,
  endStr: string
): string[] {
  return getWeekdaysInRange(fromDateStr(startStr), fromDateStr(endStr)).map(
    toDateStr
  );
}
