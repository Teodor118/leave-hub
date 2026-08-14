import { useEffect, useState } from "react";
import { http, formatApiErr, fmtRON } from "@/lib/api";
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

const empty = { destination_id: "", denumire: "", pret: 0, zile: 7, locuri_disponibile: 10 };

export default function PackagesPage() {
  const [rows, setRows] = useState([]);
  const [dests, setDests] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const [pk, ds] = await Promise.all([http.get("/packages"), http.get("/destinations")]);
    setRows(pk.data); setDests(ds.data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...empty, destination_id: dests[0]?.id || "" }); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ destination_id: r.destination_id, denumire: r.denumire, pret: r.pret, zile: r.zile, locuri_disponibile: r.locuri_disponibile }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      const payload = { ...form, pret: Number(form.pret), zile: Number(form.zile), locuri_disponibile: Number(form.locuri_disponibile) };
      if (editId) await http.put(`/packages/${editId}`, payload);
      else await http.post("/packages", payload);
      setOpen(false); toast.success(editId ? "Pachet actualizat" : "Pachet adăugat"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți acest pachet?")) return;
    try { await http.delete(`/packages/${id}`); toast.success("Pachet șters"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Pachete"
        subtitle="Ofertele turistice și locurile disponibile."
        action={<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="package-add-button" disabled={dests.length === 0}><Plus size={16} className="mr-2" />Adaugă pachet</Button>}
      />

      {rows.length === 0 ? <EmptyState text="Niciun pachet." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="packages-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Denumire</TableHead>
                <TableHead>Destinație</TableHead>
                <TableHead>Preț</TableHead>
                <TableHead>Zile</TableHead>
                <TableHead>Locuri disponibile</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.denumire}</TableCell>
                  <TableCell>{r.destination ? `${r.destination.oras}, ${r.destination.tara}` : "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{fmtRON(r.pret)}</TableCell>
                  <TableCell>{r.zile}</TableCell>
                  <TableCell data-testid={`package-seats-display-${r.id}`}>
                    <Badge className={r.locuri_disponibile === 0 ? "bg-red-100 text-red-800" : r.locuri_disponibile < 5 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>
                      {r.locuri_disponibile}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`package-edit-${r.id}`}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`package-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează pachet" : "Adaugă pachet"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Destinație</Label>
              <Select value={form.destination_id} onValueChange={(v) => setForm({ ...form, destination_id: v })}>
                <SelectTrigger data-testid="package-form-destinatie"><SelectValue placeholder="Selectează…" /></SelectTrigger>
                <SelectContent>
                  {dests.map((d) => <SelectItem key={d.id} value={d.id}>{d.oras}, {d.tara} ({d.tip})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Denumire</Label><Input value={form.denumire} onChange={(e) => setForm({ ...form, denumire: e.target.value })} data-testid="package-form-denumire" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preț (RON)</Label><Input type="number" min="0.01" step="0.01" value={form.pret} onChange={(e) => setForm({ ...form, pret: e.target.value })} data-testid="package-form-pret" /></div>
              <div><Label>Zile (1-30)</Label><Input type="number" min="1" max="30" value={form.zile} onChange={(e) => setForm({ ...form, zile: e.target.value })} data-testid="package-form-zile" /></div>
              <div><Label>Locuri</Label><Input type="number" min="0" value={form.locuri_disponibile} onChange={(e) => setForm({ ...form, locuri_disponibile: e.target.value })} data-testid="package-form-locuri" /></div>
            </div>
            {err && <div className="text-sm text-red-600" data-testid="package-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="package-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
