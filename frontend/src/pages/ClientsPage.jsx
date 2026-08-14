import { useEffect, useState } from "react";
import { http, formatApiErr, fmtDate } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const empty = { nume: "", prenume: "", email: "", telefon: "", statut: "ACTIV" };

export default function ClientsPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (statut !== "all") params.statut = statut;
    const r = await http.get("/clients", { params });
    setRows(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, statut]);

  const openAdd = () => { setForm(empty); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ nume: r.nume, prenume: r.prenume, email: r.email, telefon: r.telefon, statut: r.statut }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      if (editId) await http.put(`/clients/${editId}`, form);
      else await http.post("/clients", form);
      setOpen(false);
      toast.success(editId ? "Client actualizat" : "Client adăugat");
      load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți acest client?")) return;
    try { await http.delete(`/clients/${id}`); toast.success("Client șters"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Clienți"
        subtitle="Gestionați clienții agenției de turism."
        action={<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="client-add-button"><Plus size={16} className="mr-2" />Adaugă client</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Caută după nume sau email…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} data-testid="client-search-input" />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-44" data-testid="client-status-filter"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate</SelectItem>
            <SelectItem value="ACTIV">ACTIV</SelectItem>
            <SelectItem value="INACTIV">INACTIV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState text="Niciun client găsit." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="clients-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Prenume</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Înregistrat</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nume}</TableCell>
                  <TableCell>{r.prenume}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.telefon}</TableCell>
                  <TableCell>{fmtDate(r.data_inregistrarii)}</TableCell>
                  <TableCell>
                    <Badge data-testid="client-status-badge" className={r.statut === "ACTIV" ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>{r.statut}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`client-edit-${r.id}`}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => del(r.id)} data-testid={`client-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează client" : "Adaugă client"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nume</Label><Input value={form.nume} onChange={(e) => setForm({ ...form, nume: e.target.value })} data-testid="client-form-nume" /></div>
              <div><Label>Prenume</Label><Input value={form.prenume} onChange={(e) => setForm({ ...form, prenume: e.target.value })} data-testid="client-form-prenume" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="client-form-email" /></div>
            <div><Label>Telefon</Label><Input value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} data-testid="client-form-telefon" /></div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                <SelectTrigger data-testid="client-form-statut"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIV">ACTIV</SelectItem>
                  <SelectItem value="INACTIV">INACTIV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {err && <div className="text-sm text-red-600" data-testid="client-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="client-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
