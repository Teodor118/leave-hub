import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http, formatApiErr, fmtDate, STATUS_COLOR, STATUS_LABEL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, CheckCircle2, XCircle, Wallet, Users, Building2, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#2563eb", "#0284c7", "#16a34a", "#d97706", "#8b5cf6", "#ef4444"];

function KpiCard({ label, value, icon: Icon, tone = "blue", tid }) {
  const map = { blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600" };
  return (
    <Card className="border-slate-200" data-testid={tid}>
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${map[tone]}`}><Icon size={18} /></div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => {
    http.get("/dashboard").then((r) => setData(r.data)).catch((e) => toast.error(formatApiErr(e)));
  }, []);

  if (!data) return <div className="text-sm text-slate-500">Se încarcă…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Bun venit, ${user.name.split(" ")[0]}`} subtitle="Privire de ansamblu asupra activității tale." />

      {data.role === "USER" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Sold zile disponibile" value={data.balance.available} icon={Wallet} tone="green" tid="kpi-available" />
            <KpiCard label="Zile consumate" value={data.balance.consumed} icon={CheckCircle2} tone="amber" tid="kpi-consumed" />
            <KpiCard label="Alocare anuală" value={data.balance.annual} icon={CalendarClock} tone="blue" tid="kpi-annual" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-base">Cererile mele după status</CardTitle></CardHeader>
              <CardContent>
                {data.by_status.length === 0 ? <div className="text-sm text-slate-500 py-8 text-center">Nicio cerere</div> :
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.by_status} dataKey="count" nameKey="status" outerRadius={80} label={(e) => `${STATUS_LABEL[e.status]}: ${e.count}`}>
                        {data.by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>}
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-base">Ultimele cereri</CardTitle></CardHeader>
              <CardContent className="space-y-2" data-testid="recent-requests-list">
                {data.recent.length === 0 && <div className="text-sm text-slate-500 py-4">Nicio cerere</div>}
                {data.recent.map((r) => (
                  <Link key={r.id} to={`/requests/${r.id}`} className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:bg-slate-50">
                    <div>
                      <div className="text-sm font-medium">{r.leave_type_code} — {fmtDate(r.start_date)} → {fmtDate(r.end_date)}</div>
                      <div className="text-xs text-slate-500">{r.working_days} zile lucrătoare</div>
                    </div>
                    <Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {data.role === "DEPT_RESP" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Echipa mea" value={data.kpi.team_size} icon={Users} tone="blue" tid="kpi-team" />
            <KpiCard label="Cereri în așteptare" value={data.kpi.pending} icon={ClipboardList} tone="amber" tid="kpi-pending" />
            <KpiCard label="Absenți astăzi" value={`${data.kpi.absent_today}${data.kpi.max_absent ? ` / ${data.kpi.max_absent}` : ""}`}
              icon={data.kpi.absent_today >= (data.kpi.max_absent || Infinity) ? AlertTriangle : CheckCircle2}
              tone={data.kpi.absent_today >= (data.kpi.max_absent || Infinity) ? "red" : "green"} tid="kpi-absent-today" />
            <KpiCard label="Total aprobate" value={data.kpi.approved} icon={CheckCircle2} tone="green" tid="kpi-approved" />
          </div>
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="text-base">Cereri în așteptare — acțiune necesară</CardTitle></CardHeader>
            <CardContent className="space-y-2" data-testid="pending-list">
              {data.pending_list.length === 0 ? <div className="text-sm text-slate-500 py-4">Nicio cerere în așteptare</div> :
                data.pending_list.map((r) => (
                  <Link key={r.id} to={`/requests/${r.id}`} className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:bg-slate-50">
                    <div>
                      <div className="text-sm font-medium">{r.employee_name} — {r.leave_type_code}</div>
                      <div className="text-xs text-slate-500">{fmtDate(r.start_date)} → {fmtDate(r.end_date)} ({r.working_days} zile)</div>
                    </div>
                    <Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </Link>
                ))}
            </CardContent>
          </Card>
        </>
      )}

      {data.role === "ADMIN" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Angajați" value={data.kpi.total_users} icon={Users} tone="blue" tid="kpi-users" />
            <KpiCard label="Departamente" value={data.kpi.total_departments} icon={Building2} tone="blue" tid="kpi-departments" />
            <KpiCard label="Cereri în așteptare" value={data.kpi.pending} icon={ClipboardList} tone="amber" tid="kpi-pending" />
            <KpiCard label="Cereri aprobate" value={data.kpi.approved} icon={CheckCircle2} tone="green" tid="kpi-approved" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-base">Cereri per departament</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.per_department}>
                    <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip /><Legend />
                    <Bar dataKey="pending" name="În așteptare" fill="#d97706" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="approved" name="Aprobate" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-base">Zile aprobate per tip</CardTitle></CardHeader>
              <CardContent>
                {data.per_leave_type.length === 0 ? <div className="text-sm text-slate-500 py-8 text-center">Fără date</div> :
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={data.per_leave_type} dataKey="total_days" nameKey="code" outerRadius={90} label={(e) => `${e.code}: ${e.total_days}`}>
                        {data.per_leave_type.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
