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

const METHODS = ["CARD", "CASH", "TRANSFER"];
const METHOD_COLORS = { CARD: "bg-blue-100 text-blue-800", CASH: "bg-green-100 text-green-800", TRANSFER: "bg-violet-100 text-violet-800" };

export default function PaymentsPage() {
  const [rows, setRows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reservation_id: "", suma: 0, metoda: "CARD" });
  const [err, setErr] = useState("");

  const load = async () => {
    const [p, r] = await Promise.all([http.get("/payments"), http.get("/reservations")]);
    setRows(p.data); setReservations(r.data.filter((x) => x.stare !== "ANULATA"));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    const first = reservations.find((r) => r.sold > 0);
    setForm({ reservation_id: first?.id || reservations[0]?.id || "", suma: first?.sold || 0, metoda: "CARD" });
    setErr(""); setOpen(true);
  };

  const save = async () => {
    setErr("");
    try {
      await http.post("/payments", { ...form, suma: Number(form.suma) });
      setOpen(false); toast.success("Plată înregistrată"); load();
    } catch (e) { setErr(formatApiErr(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Ștergeți această plată?")) return;
    try { await http.delete(`/payments/${id}`); toast.success("Plată ștearsă"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  const selectedRes = reservations.find((r) => r.id === form.reservation_id);

  return (
    <div>
      <PageHeader
        title="Plăți"
        subtitle="Înregistrări manuale de plată — pot exista mai multe plăți parțiale per rezervare."
        action={<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="payment-add-button" disabled={reservations.length === 0}><Plus size={16} className="mr-2" />Înregistrează plată</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="payments-summary">
          <div className="text-xs text-slate-500">Total încasat</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">
            {fmtRON(rows.reduce((s, r) => s + r.suma, 0))}
          </div>
          <div className="text-xs text-slate-500 mt-1">{rows.length} plăți înregistrate</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500 mb-2">Sold total rămas de încasat</div>
          <div className="text-2xl font-semibold text-amber-700">
            {fmtRON(reservations.reduce((s, r) => s + Math.max(r.sold, 0), 0))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? <EmptyState text="Nicio plată înregistrată." /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <Table data-testid="payments-table">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Client (rezervare)</TableHead>
                <TableHead>Sumă</TableHead>
                <TableHead>Metodă</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmtDate(r.data_plata)}</TableCell>
                  <TableCell>{r.reservation?.client_nume || "-"}</TableCell>
                  <TableCell className="font-mono text-sm font-medium">{fmtRON(r.suma)}</TableCell>
                  <TableCell><Badge className={METHOD_COLORS[r.metoda]}>{r.metoda}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(r.id)} data-testid={`payment-delete-${r.id}`}><Trash2 size={15} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Înregistrează plată</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rezervare</Label>
              <Select value={form.reservation_id} onValueChange={(v) => {
                const r = reservations.find((x) => x.id === v);
                setForm({ ...form, reservation_id: v, suma: r?.sold || 0 });
              }}>
                <SelectTrigger data-testid="payment-reservation-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reservations.map((r) => (
                    <SelectItem key={r.id} value={r.id} disabled={r.sold <= 0}>
                      {r.client ? `${r.client.nume} ${r.client.prenume}` : "-"} · sold {fmtRON(r.sold)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRes && (
              <div className="p-3 bg-blue-50 rounded-md text-sm" data-testid="payment-remaining-balance">
                Valoare: <strong className="font-mono">{fmtRON(selectedRes.valoare)}</strong> · Sold rămas: <strong className="font-mono">{fmtRON(selectedRes.sold)}</strong>
              </div>
            )}
            <div><Label>Sumă (RON)</Label><Input type="number" step="0.01" min="0.01" value={form.suma} onChange={(e) => setForm({ ...form, suma: e.target.value })} data-testid="payment-amount-input" /></div>
            <div>
              <Label>Metodă</Label>
              <Select value={form.metoda} onValueChange={(v) => setForm({ ...form, metoda: v })}>
                <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {err && <div className="text-sm text-red-600" data-testid="payment-form-error">{err}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="payment-form-save">Salvează plata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
