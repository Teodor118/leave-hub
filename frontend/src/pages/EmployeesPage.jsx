import { useEffect, useState } from "react";
import { http, formatApiErr, fmtDate, fmtRON } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { nume: "", prenume: "", functie: "", salariu: 2500, data_angajarii: "" };

export default function EmployeesPage() {
  const [rows, setRows] = useState([]);
  const [functie, setFunctie] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const params = {};
    if (functie !== "all") params.functie = functie;
    const r = await http.get("/employees", { params });
    setRows(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [functie]);

  const functii = Array.from(new Set(rows.map((r) => r.functie)));

  const openAdd = () => { setForm(empty); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ nume: r.nume, prenume: r.prenume, functie: r.functie, salariu: r.salariu, data_angajarii: r.data_angajarii || "" }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      const payload = { ...form, salariu: Number(form.salariu) };
      if (!payload.data_angajarii) delete payload.data_angajarii;
      if (editId) await http.put(`/employees/${editId}`, payload);
      else await http.post("/employees", payload);
      setOpen(false); toast.success(editId ? "Angajat actualizat" : "Angajat adăugat"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți acest angajat?")) return;
    try { await http.delete(`/employees/${id}`); toast.success("Angajat șters"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Angajați"
        subtitle="Personalul agenției și rolurile lor."
        action={<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="employee-add-button"><Plus size={16} className="mr-2" />Adaugă angajat</Button>}
      />

      <div className="flex gap-3 mb-4">
        <Select value={functie} onValueChange={setFunctie}>
          <SelectTrigger className="w-56" data-testid="employee-function-filter"><SelectValue placeholder="Filtrare funcție" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate funcțiile</SelectItem>
            {functii.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? <EmptyState text="Niciun angajat." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="employees-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Prenume</TableHead>
                <TableHead>Funcție</TableHead>
                <TableHead>Salariu</TableHead>
                <TableHead>Angajat din</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nume}</TableCell>
                  <TableCell>{r.prenume}</TableCell>
                  <TableCell>{r.functie}</TableCell>
                  <TableCell className="font-mono text-sm">{fmtRON(r.salariu)}</TableCell>
                  <TableCell>{fmtDate(r.data_angajarii)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`employee-edit-${r.id}`}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`employee-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează angajat" : "Adaugă angajat"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nume</Label><Input value={form.nume} onChange={(e) => setForm({ ...form, nume: e.target.value })} data-testid="employee-form-nume" /></div>
              <div><Label>Prenume</Label><Input value={form.prenume} onChange={(e) => setForm({ ...form, prenume: e.target.value })} data-testid="employee-form-prenume" /></div>
            </div>
            <div><Label>Funcție</Label><Input value={form.functie} onChange={(e) => setForm({ ...form, functie: e.target.value })} data-testid="employee-form-functie" /></div>
            <div><Label>Salariu (min. 2500 RON)</Label><Input type="number" min="2500" value={form.salariu} onChange={(e) => setForm({ ...form, salariu: e.target.value })} data-testid="employee-salary-input" /></div>
            <div><Label>Data angajării</Label><Input type="date" value={form.data_angajarii} onChange={(e) => setForm({ ...form, data_angajarii: e.target.value })} data-testid="employee-form-data" /></div>
            {err && <div className="text-sm text-red-600" data-testid="employee-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="employee-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
