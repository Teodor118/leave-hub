import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http, formatApiErr, fmtDate, STATUS_COLOR, STATUS_LABEL } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye } from "lucide-react";
import LeaveRequestFormDialog from "@/components/LeaveRequestFormDialog";
import { toast } from "sonner";

export default function MyRequestsPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const params = { scope: "self" };
    if (status !== "all") params.status = status;
    const r = await http.get("/leave-requests", { params });
    setRows(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <PageHeader title="Cererile mele" subtitle="Vizualizează și trimite cereri de concediu."
        action={<Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)} data-testid="new-request-button"><Plus size={16} className="mr-2" />Cerere nouă</Button>} />

      <div className="flex gap-3 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56" data-testid="status-filter"><SelectValue placeholder="Filtrare status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate</SelectItem>
            {Object.keys(STATUS_LABEL).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? <EmptyState text="Nicio cerere. Creează prima cerere cu butonul de sus." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="my-requests-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Creat</TableHead>
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
                  <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                  <TableCell><Badge variant="secondary" className="bg-slate-100">{r.leave_type_code}</Badge> <span className="text-xs text-slate-600 ml-1">{r.leave_type_name}</span></TableCell>
                  <TableCell className="text-sm">{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</TableCell>
                  <TableCell className="font-medium">{r.working_days}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Link to={`/requests/${r.id}`}>
                      <Button size="sm" variant="ghost" data-testid={`view-request-${r.id}`}><Eye size={15} /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LeaveRequestFormDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}
