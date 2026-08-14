import { useEffect, useState } from "react";
import { http, formatApiErr } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { department_name: "", manager_id: "", max_absent_employees: 2 };

export default function DepartmentsPage() {
  const [rows, setRows] = useState([]);
  const [managers, setManagers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const [d, u] = await Promise.all([http.get("/departments"), http.get("/users")]);
    setRows(d.data);
    setManagers(u.data.filter((x) => x.role === "DEPT_RESP" || x.role === "ADMIN"));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ department_name: r.department_name, manager_id: r.manager_id || "", max_absent_employees: r.max_absent_employees }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      const payload = { ...form, max_absent_employees: Number(form.max_absent_employees) };
      if (!payload.manager_id) delete payload.manager_id;
      if (editId) await http.put(`/departments/${editId}`, payload);
      else await http.post("/departments", payload);
      setOpen(false); toast.success(editId ? "Departament actualizat" : "Departament creat"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți departamentul?")) return;
    try { await http.delete(`/departments/${id}`); toast.success("Șters"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader title="Departamente" subtitle="Structura organizatorică și limite de absență."
        action={<Button className="bg-blue-600 hover:bg-blue-700" onClick={openAdd} data-testid="dept-add-button"><Plus size={16} className="mr-2" /> Adaugă departament</Button>} />

      {rows.length === 0 ? <EmptyState text="Niciun departament." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="depts-table">
            <TableHeader className="bg-slate-50"><TableRow>
              <TableHead>Denumire</TableHead><TableHead>Manager</TableHead>
              <TableHead>Angajați</TableHead><TableHead>Max. absenți simultan</TableHead>
              <TableHead className="text-right">Acțiuni</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.department_name}</TableCell>
                  <TableCell>{r.manager_name || <span className="text-slate-400">-</span>}</TableCell>
                  <TableCell>{r.employee_count}</TableCell>
                  <TableCell className="font-mono">{r.max_absent_employees}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`dept-edit-${r.id}`}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`dept-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează departament" : "Departament nou"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Denumire</Label><Input value={form.department_name} onChange={(e) => setForm({ ...form, department_name: e.target.value })} data-testid="dept-form-name" /></div>
            <div>
              <Label>Manager</Label>
              <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                <SelectTrigger data-testid="dept-form-manager"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nr. maxim de angajați absenți simultan</Label><Input type="number" min="1" max="100" value={form.max_absent_employees} onChange={(e) => setForm({ ...form, max_absent_employees: e.target.value })} data-testid="dept-form-max" /></div>
            {err && <div className="text-sm text-red-600" data-testid="dept-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={save} data-testid="dept-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
