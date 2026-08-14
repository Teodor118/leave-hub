import { useEffect, useState } from "react";
import { http, formatApiErr, fmtRON, fmtDate } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["CONFIRMATA", "ANULATA", "FINALIZATA"];
const STATUS_LABELS = { CONFIRMATA: "CONFIRMATĂ", ANULATA: "ANULATĂ", FINALIZATA: "FINALIZATĂ" };
const STATUS_COLORS = { CONFIRMATA: "bg-blue-100 text-blue-800", ANULATA: "bg-slate-200 text-slate-700", FINALIZATA: "bg-green-100 text-green-800" };

const empty = { client_id: "", package_id: "", employee_id: "", numar_persoane: 1 };

export default function ReservationsPage() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");

  const load = async () => {
    const [r, c, p, e] = await Promise.all([
      http.get("/reservations"),
      http.get("/clients"),
      http.get("/packages"),
      http.get("/employees"),
    ]);
    setRows(r.data); setClients(c.data); setPackages(p.data); setEmployees(e.data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({
      client_id: clients[0]?.id || "",
      package_id: packages.find((p) => p.locuri_disponibile > 0)?.id || packages[0]?.id || "",
      employee_id: employees[0]?.id || "",
      numar_persoane: 1,
    });
    setErr(""); setOpen(true);
  };

  const save = async () => {
    setErr("");
    try {
      const payload = { ...form, numar_persoane: Number(form.numar_persoane) };
      await http.post("/reservations", payload);
      setOpen(false); toast.success("Rezervare creată"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const changeStatus = async (id, stare) => {
    try { await http.put(`/reservations/${id}/status`, { stare }); toast.success("Stare actualizată"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți rezervarea? Locurile vor fi restituite dacă este cazul.")) return;
    try { await http.delete(`/reservations/${id}`); toast.success("Rezervare ștearsă"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  const selectedPkg = packages.find((p) => p.id === form.package_id);
  const estValoare = selectedPkg ? Number(form.numar_persoane || 0) * selectedPkg.pret : 0;

  return (
    <div>
      <PageHeader
        title="Rezervări"
        subtitle="Gestionați rezervările clienților și schimbați starea acestora."
        action={<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="reservation-add-button" disabled={!clients.length || !packages.length || !employees.length}><Plus size={16} className="mr-2" />Rezervare nouă</Button>}
      />

      {rows.length === 0 ? <EmptyState text="Nicio rezervare." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="reservations-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Pachet</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Pers.</TableHead>
                <TableHead>Valoare</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Stare</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmtDate(r.data_rezervare)}</TableCell>
                  <TableCell className="font-medium">{r.client ? `${r.client.nume} ${r.client.prenume}` : "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.package?.denumire || "-"}</TableCell>
                  <TableCell>{r.employee ? `${r.employee.nume} ${r.employee.prenume}` : "-"}</TableCell>
                  <TableCell>{r.numar_persoane}</TableCell>
                  <TableCell className="font-mono text-sm">{fmtRON(r.valoare)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <span className={r.sold > 0 ? "text-amber-700" : "text-green-700"}>{fmtRON(r.sold)}</span>
                  </TableCell>
                  <TableCell>
                    <Select value={r.stare} onValueChange={(v) => changeStatus(r.id, v)}>
                      <SelectTrigger className="w-36" data-testid={`reservation-status-select-${r.id}`}>
                        <SelectValue>
                          <Badge className={STATUS_COLORS[r.stare]}>{STATUS_LABELS[r.stare]}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`reservation-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Rezervare nouă</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger data-testid="reservation-form-client"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nume} {c.prenume} ({c.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pachet</Label>
              <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                <SelectTrigger data-testid="reservation-form-package"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.locuri_disponibile === 0}>
                      {p.denumire} · {fmtRON(p.pret)} · {p.locuri_disponibile} locuri
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agent turism</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger data-testid="reservation-form-employee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.nume} {e.prenume} · {e.functie}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Număr persoane (1-20)</Label>
              <Input type="number" min="1" max="20" value={form.numar_persoane} onChange={(e) => setForm({ ...form, numar_persoane: e.target.value })} data-testid="reservation-persons-input" />
            </div>
            {selectedPkg && (
              <div className="p-3 bg-blue-50 rounded-md text-sm">
                Valoare estimată: <strong className="font-mono">{fmtRON(estValoare)}</strong>
                <div className="text-xs text-slate-600 mt-1">
                  {selectedPkg.locuri_disponibile} locuri disponibile în pachet
                </div>
              </div>
            )}
            {err && <div className="text-sm text-red-600" data-testid="reservation-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="reservation-form-save">Creează rezervarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
