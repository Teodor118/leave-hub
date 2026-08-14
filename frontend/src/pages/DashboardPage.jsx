import { useEffect, useState } from "react";
import { http, fmtRON, formatApiErr } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, Package, Wallet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";

const COLORS = ["#2563eb", "#0284c7", "#16a34a", "#d97706", "#8b5cf6"];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    http.get("/reports/dashboard").then((r) => setData(r.data)).catch((e) => toast.error(formatApiErr(e)));
  }, []);

  if (!data) return <div className="text-sm text-slate-500">Se încarcă…</div>;

  const kpis = [
    { label: "Rezervări totale", value: data.kpi.total_reservations, icon: CalendarCheck, tid: "kpi-total-reservations" },
    { label: "Venit total", value: fmtRON(data.kpi.total_revenue), icon: Wallet, tid: "kpi-total-revenue" },
    { label: "Clienți activi", value: data.kpi.active_clients, icon: Users, tid: "kpi-active-clients" },
    { label: "Pachete", value: data.kpi.total_packages, icon: Package, tid: "kpi-total-packages" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tablou de comandă</h1>
        <p className="text-sm text-slate-500 mt-1">Privire de ansamblu asupra activității agenției.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-slate-200" data-testid={k.tid}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-500">{k.label}</div>
                  <div className="text-2xl font-semibold text-slate-900 mt-1">{k.value}</div>
                </div>
                <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
                  <k.icon size={18} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200" data-testid="chart-popular-packages">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pachete populare</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.popular_packages} margin={{ left: 0, right: 10, top: 10, bottom: 30 }}>
                <XAxis dataKey="denumire" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Rezervări" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="chart-revenue-by-payment-method">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Venit per metodă de plată</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.revenue_by_method} dataKey="total" nameKey="metoda" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.metoda}: ${fmtRON(e.total)}`}>
                  {data.revenue_by_method.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200" data-testid="chart-reservations-per-client">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rezervări per client (top 8)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.reservations_per_client} margin={{ left: 0, right: 10, top: 10, bottom: 30 }}>
              <XAxis dataKey="client" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Rezervări" fill="#0284c7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
