import { useEffect, useMemo, useState } from "react";
import { http, fmtDate, STATUS_COLOR, STATUS_LABEL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const MONTH_NAMES = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const DAY_NAMES = ["L", "Ma", "Mi", "J", "V", "S", "D"];

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}
function pad(n) { return String(n).padStart(2, "0"); }

export default function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [items, setItems] = useState([]);

  const range = useMemo(() => {
    const start = `${cursor.y}-${pad(cursor.m + 1)}-01`;
    const end = `${cursor.y}-${pad(cursor.m + 1)}-${pad(daysInMonth(cursor.y, cursor.m))}`;
    return { start, end };
  }, [cursor]);

  useEffect(() => {
    http.get("/calendar", { params: range }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [range]);

  const dayCells = useMemo(() => {
    const total = daysInMonth(cursor.y, cursor.m);
    const firstDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Monday=0
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const iso = `${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`;
      const inDay = items.filter((r) => r.start_date <= iso && r.end_date >= iso);
      cells.push({ day: d, iso, requests: inDay });
    }
    return cells;
  }, [cursor, items]);

  const prev = () => setCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 });
  const next = () => setCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 });

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={user.role === "ADMIN" ? "Toate absențele planificate și aprobate." : "Absențele din departamentul tău."}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prev} data-testid="cal-prev"><ChevronLeft size={15} /></Button>
            <div className="text-sm font-medium min-w-[140px] text-center" data-testid="cal-title">{MONTH_NAMES[cursor.m]} {cursor.y}</div>
            <Button variant="outline" size="sm" onClick={next} data-testid="cal-next"><ChevronRight size={15} /></Button>
          </div>
        }
      />

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {DAY_NAMES.map((d) => <div key={d} className="text-xs font-semibold text-slate-500 text-center uppercase">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2" data-testid="calendar-grid">
            {dayCells.map((c, i) => (
              <div key={i} className={`min-h-[90px] rounded-md p-2 text-xs ${c ? "bg-white border border-slate-200" : "bg-transparent"}`}>
                {c && (
                  <>
                    <div className="font-medium text-slate-700 mb-1">{c.day}</div>
                    <div className="space-y-1">
                      {c.requests.slice(0, 3).map((r) => (
                        <Link key={r.id} to={`/requests/${r.id}`} className={`block rounded px-1.5 py-0.5 truncate ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`} title={`${r.employee_name} — ${r.leave_type_code}`}>
                          {r.employee_name.split(" ")[0]} · {r.leave_type_code}
                        </Link>
                      ))}
                      {c.requests.length > 3 && <div className="text-slate-500 text-[10px]">+{c.requests.length - 3} mai multe</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {items.length === 0 && <div className="mt-4"><EmptyState text="Nicio absență în luna curentă." /></div>}
    </div>
  );
}
