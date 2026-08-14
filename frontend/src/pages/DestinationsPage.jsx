import { useEffect, useState } from "react";
import { http, formatApiErr } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Waves, Mountain, Building2, Landmark } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["MARE", "MUNTE", "CITY BREAK", "CULTURAL"];
const TYPE_ICON = { "MARE": Waves, "MUNTE": Mountain, "CITY BREAK": Building2, "CULTURAL": Landmark };
const TYPE_COLOR = { "MARE": "bg-sky-100 text-sky-800", "MUNTE": "bg-emerald-100 text-emerald-800", "CITY BREAK": "bg-violet-100 text-violet-800", "CULTURAL": "bg-amber-100 text-amber-800" };

const empty = { tara: "", oras: "", tip: "MARE" };

export default function DestinationsPage() {
  const [rows, setRows] = useState([]);
  const [tip, setTip] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const params = {};
    if (tip !== "all") params.tip = tip;
    const r = await http.get("/destinations", { params });
    setRows(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tip]);

  const openAdd = () => { setForm(empty); setEditId(null); setErr(""); setOpen(true); };
  const openEdit = (r) => { setForm({ tara: r.tara, oras: r.oras, tip: r.tip }); setEditId(r.id); setErr(""); setOpen(true); };

  const save = async () => {
    setErr("");
    try {
      if (editId) await http.put(`/destinations/${editId}`, form);
      else await http.post("/destinations", form);
      setOpen(false); toast.success(editId ? "Destinație actualizată" : "Destinație adăugată"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți această destinație?")) return;
    try { await http.delete(`/destinations/${id}`); toast.success("Destinație ștearsă"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  // group by tip
  const grouped = TYPES.map((t) => ({ tip: t, items: rows.filter((r) => r.tip === t) })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Destinații"
        subtitle="Locațiile disponibile pentru pachete turistice."
        action={<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="destination-add-button"><Plus size={16} className="mr-2" />Adaugă destinație</Button>}
      />

      <div className="flex gap-3 mb-4">
        <Select value={tip} onValueChange={setTip}>
          <SelectTrigger className="w-56" data-testid="destination-type-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate tipurile</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? <EmptyState text="Nicio destinație." /> : (
        <div className="space-y-6" data-testid="destinations-table">
          {grouped.map((g) => {
            const Icon = TYPE_ICON[g.tip];
            return (
              <div key={g.tip}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className="text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{g.tip}</h3>
                  <Badge className={TYPE_COLOR[g.tip]}>{g.items.length}</Badge>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Țară</TableHead>
                        <TableHead>Oraș</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.tara}</TableCell>
                          <TableCell>{r.oras}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`destination-edit-${r.id}`}><Pencil size={15} /></Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`destination-delete-${r.id}`}><Trash2 size={15} /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Editează destinație" : "Adaugă destinație"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Țară</Label><Input value={form.tara} onChange={(e) => setForm({ ...form, tara: e.target.value })} data-testid="destination-form-tara" /></div>
            <div><Label>Oraș</Label><Input value={form.oras} onChange={(e) => setForm({ ...form, oras: e.target.value })} data-testid="destination-form-oras" /></div>
            <div>
              <Label>Tip</Label>
              <Select value={form.tip} onValueChange={(v) => setForm({ ...form, tip: v })}>
                <SelectTrigger data-testid="destination-form-tip"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {err && <div className="text-sm text-red-600" data-testid="destination-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="destination-form-save">Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
