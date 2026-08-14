import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http, fmtDate, STATUS_COLOR, STATUS_LABEL, formatApiErr } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AllRequestsPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");

  const load = async () => {
    const params = { scope: "all" };
    if (status !== "all") params.status = status;
    const r = await http.get("/leave-requests", { params });
    setRows(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const del = async (id) => {
    if (!window.confirm("Șterge cererea? Dacă e aprobată, zilele revin în soldul angajatului.")) return;
    try { await http.delete(`/leave-requests/${id}`); toast.success("Cerere ștearsă"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader title="Toate cererile" subtitle="Vizualizare globală a tuturor cererilor de concediu." />
      <div className="flex gap-3 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56" data-testid="all-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate</SelectItem>
            {Object.keys(STATUS_LABEL).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? <EmptyState text="Nicio cerere." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="all-requests-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Angajat</TableHead>
                <TableHead>Departament</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Perioadă</TableHead>
                <TableHead>Zile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-xs">{r.department_name || "-"}</TableCell>
                  <TableCell><Badge variant="secondary" className="bg-slate-100">{r.leave_type_code}</Badge></TableCell>
                  <TableCell className="text-sm">{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</TableCell>
                  <TableCell className="font-medium">{r.working_days}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Link to={`/requests/${r.id}`}>
                      <Button size="sm" variant="ghost" data-testid={`admin-view-${r.id}`}><Eye size={15} /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`admin-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
