import { CalendarDays } from "lucide-react";
import type { TimetableDay } from "@/types/database";
import type { TimetableCell, TimetableGrid } from "@/services/timetable";
import { DAY_LABELS, TIMETABLE_DAYS, formatPeriodTime } from "@/lib/timetable-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The read-only week. Rendered on the server so a student gets the whole grid in
 * the first response rather than an empty shell and a fetch.
 *
 * Today's column is marked, computed from the server's date. A student opening
 * this at 23:30 in a timezone behind the server sees tomorrow's column
 * highlighted for a few hours, which is a far smaller cost than the column that
 * never moves, or a "today" that disagrees with the date in the header.
 */
export function TimetableView({
  grid,
  className,
}: {
  grid: TimetableGrid;
  className: string | null;
}) {
  const today = new Date().getDay();
  const isoToday = today === 0 ? 7 : today;

  const byCell = new Map<string, TimetableCell>();
  for (const cell of grid.cells) byCell.set(`${cell.day}:${cell.periodId}`, cell);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" aria-hidden />
          This week
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {className ? `Timetable for ${className}.` : "Your class timetable."}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">
            Weekly lesson timetable, periods down the side and days across.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-40 px-2 py-2 text-left font-medium">
                Period
              </th>
              {TIMETABLE_DAYS.map((day: TimetableDay) => (
                <th
                  key={day}
                  scope="col"
                  className={`px-2 py-2 text-left font-medium ${
                    day === isoToday ? "text-primary" : ""
                  }`}
                >
                  {DAY_LABELS[day]}
                  {day === isoToday && (
                    <span className="ml-1 text-xs font-normal">(today)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.periods.map((period) => {
              if (period.is_break) {
                return (
                  <tr key={period.id} className="border-t bg-muted/50">
                    <th scope="row" className="px-2 py-2 text-left font-medium text-muted-foreground">
                      {period.name}
                    </th>
                    <td
                      colSpan={TIMETABLE_DAYS.length}
                      className="px-2 py-2 text-muted-foreground"
                    >
                      {formatPeriodTime(period.start_time, period.end_time)} — break
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={period.id} className="border-t align-top">
                  <th scope="row" className="px-2 py-2 text-left font-medium">
                    <span className="block">{period.name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatPeriodTime(period.start_time, period.end_time)}
                    </span>
                  </th>
                  {TIMETABLE_DAYS.map((day: TimetableDay) => {
                    const cell = byCell.get(`${day}:${period.id}`);
                    return (
                      <td key={day} className="px-2 py-2">
                        {cell ? (
                          <>
                            <span className="block font-medium">{cell.subjectName ?? "Subject"}</span>
                            {cell.teacherName && (
                              <span className="block text-xs text-muted-foreground">
                                {cell.teacherName}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
