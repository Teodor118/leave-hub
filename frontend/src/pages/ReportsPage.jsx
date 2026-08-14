import { useEffect, useState } from "react";
import { http, fmtRON, fmtDate, formatApiErr } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const STATUS_COLORS = { CONFIRMATA: "bg-blue-100 text-blue-800", ANULATA: "bg-slate-200 text-slate-700", FINALIZATA: "bg-green-100 text-green-800" };
const STATUS_LABELS = { CONFIRMATA: "CONFIRMATĂ", ANULATA: "ANULATĂ", FINALIZATA: "FINALIZATĂ" };

export default function ReportsPage() {
  const [dashboard, setDashboard] = useState(null);
  const [detailed, setDetailed] = useState([]);

  useEffect(() => {
    Promise.all([http.get("/reports/dashboard"), http.get("/reports/detailed")])
      .then(([d, det]) => { setDashboard(d.data); setDetailed(det.data); })
      .catch((e) => toast.error(formatApiErr(e)));
  }, []);

  if (!dashboard) return <div className="text-sm text-slate-500">Se încarcă…</div>;

  return (
    <div>
      <PageHeader title="Rapoarte" subtitle="Agregări pe baza rezervărilor și plăților." />

      <Tabs defaultValue="clienti" className="space-y-4">
        <TabsList data-testid="reports-tabs">
          <TabsTrigger value="clienti" data-testid="tab-clienti">Rezervări per client</TabsTrigger>
          <TabsTrigger value="pachete" data-testid="tab-pachete">Pachete populare</TabsTrigger>
          <TabsTrigger value="venit" data-testid="tab-venit">Venit per metodă</TabsTrigger>
          <TabsTrigger value="detaliat" data-testid="tab-detaliat">Vedere detaliată</TabsTrigger>
        </TabsList>

        <TabsContent value="clienti">
          <Card className="border-slate-200" data-testid="reports-aggregated-table">
            <CardHeader><CardTitle className="text-base">Rezervări per client</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Client</TableHead><TableHead>Nr. rezervări</TableHead><TableHead>Valoare totală</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {dashboard.reservations_per_client.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.client}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell className="font-mono">{fmtRON(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pachete">
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="text-base">Pachete populare</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Pachet</TableHead><TableHead>Nr. rezervări</TableHead><TableHead>Persoane totale</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {dashboard.popular_packages.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.denumire}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{r.persoane}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="venit">
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="text-base">Venit per metodă de plată</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Metodă</TableHead><TableHead>Nr. tranzacții</TableHead><TableHead>Total încasat</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {dashboard.revenue_by_method.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge className="bg-blue-100 text-blue-800">{r.metoda}</Badge></TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell className="font-mono">{fmtRON(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detaliat">
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="text-base">Vedere detaliată rezervări</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Pachet</TableHead>
                  <TableHead>Destinație</TableHead>
                  <TableHead>Pers.</TableHead>
                  <TableHead>Valoare</TableHead>
                  <TableHead>Plătit</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Stare</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {detailed.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{fmtDate(r.data_rezervare)}</TableCell>
                      <TableCell className="font-medium">{r.client ? `${r.client.nume} ${r.client.prenume}` : "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{r.package?.denumire || "-"}</TableCell>
                      <TableCell className="text-xs">{r.package?.destination ? `${r.package.destination.oras}, ${r.package.destination.tara}` : "-"}</TableCell>
                      <TableCell>{r.numar_persoane}</TableCell>
                      <TableCell className="font-mono text-sm">{fmtRON(r.valoare)}</TableCell>
                      <TableCell className="font-mono text-sm text-green-700">{fmtRON(r.total_platit)}</TableCell>
                      <TableCell className="font-mono text-sm text-amber-700">{fmtRON(r.sold)}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[r.stare]}>{STATUS_LABELS[r.stare]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
