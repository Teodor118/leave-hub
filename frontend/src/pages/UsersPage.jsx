import { useEffect, useState } from "react";
import { http, formatApiErr, ROLE_LABEL } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", email: "", password: "", role: "USER", dept_id: "", annual_leave_days: 21 };

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [depts, setDepts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const [u, d] = await Promise.all([http.get("/users"), http.get("/departments")]);
    setRows(u.data); setDepts(d.data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...empty, dept_id: depts[0]?.id || "" }); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ name: r.name, email: r.email, password: "", role: r.role, dept_id: r.dept_id || "", annual_leave_days: r.annual_leave_days }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      const payload = { ...form, annual_leave_days: Number(form.annual_leave_days) };
      if (!payload.dept_id) delete payload.dept_id;
      if (editId && !payload.password) delete payload.password;
      if (editId) await http.put(`/users/${editId}`, payload);
      else await http.post("/users", payload);
      setOpen(false); toast.success(editId ? "Utilizator actualizat" : "Utilizator creat"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Șterge acest utilizator?")) return;
    try { await http.delete(`/users/${id}`); toast.success("Șters"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader title="Angajați" subtitle="Gestionare conturi utilizatori, roluri și solduri."
        action={<Button className="bg-blue-600 hover:bg-blue-700" onClick={openAdd} data-testid="user-add-button"><Plus size={16} className="mr-2" /> Adaugă utilizator</Button>} />

      {rows.length === 0 ? <EmptyState text="Niciun utilizator." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="users-table">
            <TableHeader className="bg-slate-50"><TableRow>
              <TableHead>Nume</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead>
              <TableHead>Departament</TableHead><TableHead>Sold (disp./total)</TableHead>
              <TableHead className="text-right">Acțiuni</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell><Badge className="bg-blue-100 text-blue-800">{ROLE_LABEL[r.role]}</Badge></TableCell>
                  <TableCell>{r.department_name || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{r.available_leave_days} / {r.annual_leave_days}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`user-edit-${r.id}`}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`user-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează utilizator" : "Utilizator nou"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nume complet</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-form-name" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-form-email" /></div>
            <div><Label>{editId ? "Parolă nouă (opțional)" : "Parolă"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? "Lăsați gol pentru păstrare" : "Min 6 caractere"} data-testid="user-form-password" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="user-form-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">{ROLE_LABEL.USER}</SelectItem>
                    <SelectItem value="DEPT_RESP">{ROLE_LABEL.DEPT_RESP}</SelectItem>
                    <SelectItem value="ADMIN">{ROLE_LABEL.ADMIN}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departament</Label>
                <Select value={form.dept_id} onValueChange={(v) => setForm({ ...form, dept_id: v })}>
                  <SelectTrigger data-testid="user-form-dept"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Zile concediu anual</Label><Input type="number" min="0" max="60" value={form.annual_leave_days} onChange={(e) => setForm({ ...form, annual_leave_days: e.target.value })} data-testid="user-form-days" /></div>
            {err && <div className="text-sm text-red-600" data-testid="user-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={save} data-testid="user-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
