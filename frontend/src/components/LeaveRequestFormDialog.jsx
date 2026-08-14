import { useEffect, useState } from "react";
import { http, formatApiErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LeaveRequestFormDialog({ open, onOpenChange, onSaved }) {
  const [types, setTypes] = useState([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [workingDays, setWorkingDays] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      http.get("/leave-types").then((r) => {
        setTypes(r.data);
        const co = r.data.find((t) => t.code === "CO");
        setLeaveTypeId(co?.id || r.data[0]?.id || "");
      });
      setStart(""); setEnd(""); setWorkingDays(null); setAttachment(null); setErr("");
    }
  }, [open]);

  useEffect(() => {
    if (!startDate || !endDate) { setWorkingDays(null); return; }
    http.get("/leave-requests/preview/working-days", { params: { start_date: startDate, end_date: endDate } })
      .then((r) => setWorkingDays(r.data.working_days))
      .catch(() => setWorkingDays(null));
  }, [startDate, endDate]);

  const selectedType = types.find((t) => t.id === leaveTypeId);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Fișier prea mare (max 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(",")[1];
      setAttachment({ file_name: f.name, content_base64: b64 });
    };
    reader.readAsDataURL(f);
  };

  const submit = async (submitFlag) => {
    setErr(""); setBusy(true);
    try {
      await http.post("/leave-requests", {
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        attachment,
        submit: submitFlag,
      });
      toast.success(submitFlag ? "Cerere trimisă spre aprobare" : "Ciornă salvată");
      onOpenChange(false);
      onSaved?.();
    } catch (e) { setErr(formatApiErr(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg">
        <DialogHeader><DialogTitle>Cerere nouă de concediu</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tip concediu</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger data-testid="request-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.code}) {t.requires_attachment ? "· atașament obligatoriu" : ""} {!t.paid ? "· neplătit" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data început</Label><Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} data-testid="request-start-date" /></div>
            <div><Label>Data sfârșit</Label><Input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} data-testid="request-end-date" /></div>
          </div>
          {workingDays !== null && (
            <div className="bg-blue-50 rounded-md p-3 text-sm" data-testid="request-working-days">
              <strong>{workingDays}</strong> zile lucrătoare (excluzând week-end și sărbători legale)
            </div>
          )}
          {selectedType?.requires_attachment && (
            <div>
              <Label className="flex items-center gap-1"><Paperclip size={14} /> Atașament (obligatoriu)</Label>
              <Input type="file" onChange={handleFile} data-testid="request-attachment-input" />
              {attachment && <div className="text-xs text-slate-600 mt-1">✓ {attachment.file_name}</div>}
            </div>
          )}
          {err && <Alert variant="destructive" data-testid="request-form-error"><AlertDescription>{err}</AlertDescription></Alert>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit(false)} disabled={busy || !startDate || !endDate} data-testid="request-save-draft">
            Salvează ciornă
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => submit(true)} disabled={busy || !startDate || !endDate} data-testid="request-submit">
            {busy && <Loader2 className="animate-spin mr-2" size={15} />} Trimite spre aprobare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
