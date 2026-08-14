import { useEffect, useState } from "react";
import { http, formatApiErr } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", code: "", requires_attachment: false, paid: true };

export default function LeaveTypesPage() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => { const r = await http.get("/leave-types"); setRows(r.data); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ name: r.name, code: r.code, requires_attachment: !!r.requires_attachment, paid: !!r.paid }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      if (editId) await http.put(`/leave-types/${editId}`, form);
      else await http.post("/leave-types", form);
      setOpen(false); toast.success(editId ? "Actualizat" : "Adăugat"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Șterge tipul de concediu?")) return;
    try { await http.delete(`/leave-types/${id}`); toast.success("Șters"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader title="Tipuri de concediu" subtitle="Configurează tipurile de concediu disponibile în sistem."
        action={<Button className="bg-blue-600 hover:bg-blue-700" onClick={openAdd} data-testid="lt-add-button"><Plus size={16} className="mr-2" /> Adaugă tip</Button>} />

      {rows.length === 0 ? <EmptyState text="Niciun tip definit." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="lt-table">
            <TableHeader className="bg-slate-50"><TableRow>
              <TableHead>Cod</TableHead><TableHead>Denumire</TableHead>
              <TableHead>Atașament obligatoriu</TableHead><TableHead>Plătit</TableHead>
              <TableHead className="text-right">Acțiuni</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Badge className="bg-blue-100 text-blue-800">{r.code}</Badge></TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.requires_attachment ? <Badge className="bg-amber-100 text-amber-800">DA</Badge> : <span className="text-slate-400">nu</span>}</TableCell>
                  <TableCell>{r.paid ? <Badge className="bg-emerald-100 text-emerald-800">DA</Badge> : <span className="text-slate-400">nu</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`lt-edit-${r.id}`}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`lt-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează tip concediu" : "Tip concediu nou"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Denumire</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="lt-form-name" /></div>
            <div><Label>Cod (ex. CO, CM, FP)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} data-testid="lt-form-code" /></div>
            <div className="flex items-center justify-between border border-slate-200 rounded-md p-3">
              <div>
                <Label>Atașament obligatoriu</Label>
                <div className="text-xs text-slate-500 mt-1">Ex. adeverință medicală</div>
              </div>
              <Switch checked={form.requires_attachment} onCheckedChange={(v) => setForm({ ...form, requires_attachment: v })} data-testid="lt-form-attach" />
            </div>
            <div className="flex items-center justify-between border border-slate-200 rounded-md p-3">
              <div>
                <Label>Concediu plătit</Label>
                <div className="text-xs text-slate-500 mt-1">Se scade din soldul angajatului</div>
              </div>
              <Switch checked={form.paid} onCheckedChange={(v) => setForm({ ...form, paid: v })} data-testid="lt-form-paid" />
            </div>
            {err && <div className="text-sm text-red-600" data-testid="lt-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={save} data-testid="lt-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
