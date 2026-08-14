import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { http, formatApiErr, fmtDate, STATUS_COLOR, STATUS_LABEL, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, XCircle, XOctagon, Send, FileDown, Paperclip, Clock } from "lucide-react";
import { toast } from "sonner";

export default function RequestDetailPage() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [req, setReq] = useState(null);
  const [wf, setWf] = useState([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  const load = async () => {
    try {
      const r = await http.get(`/leave-requests/${id}`);
      setReq(r.data);
      const w = await http.get(`/leave-requests/${id}/workflow`);
      setWf(w.data);
    } catch (e) { toast.error(formatApiErr(e)); nav("/dashboard"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!req) return <div className="text-sm text-slate-500">Se încarcă…</div>;

  const isOwner = req.empl_id === user.id;
  const isManagerOfDept = user.role === "DEPT_RESP" && req.dept_id === user.dept_id;
  const isAdmin = user.role === "ADMIN";
  const canApprove = req.status === "PENDING" && (isManagerOfDept || isAdmin);
  const canCancel = (req.status === "DRAFT" || req.status === "PENDING") && (isOwner || isAdmin);
  const canSubmit = req.status === "DRAFT" && isOwner;

  const action = async (act, cm) => {
    try {
      await http.put(`/leave-requests/${id}/action`, { action: act, comment: cm });
      toast.success("Acțiune efectuată");
      await refresh();
      load();
    } catch (e) { toast.error(formatApiErr(e)); }
  };

  const doReject = async () => {
    if (!comment.trim()) { toast.error("Motivul este obligatoriu"); return; }
    setRejectOpen(false);
    await action("REJECT", comment);
    setComment("");
  };

  const downloadAttachment = async (aid, name) => {
    const r = await http.get(`/attachments/${aid}`);
    const b = atob(r.data.content_base64);
    const buf = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) buf[i] = b.charCodeAt(i);
    const blob = new Blob([buf]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name || r.data.file_name; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const t = localStorage.getItem("token");
    const r = await fetch(`${API}/leave-requests/${id}/pdf`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) { toast.error("Eroare la generarea PDF"); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cerere_${id.slice(0, 8)}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to={-1} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 mb-4" onClick={(e) => { e.preventDefault(); nav(-1); }} data-testid="back-link">
          <ArrowLeft size={15} /> Înapoi
        </Link>
        <PageHeader
          title={`Cerere ${req.leave_type_code}`}
          subtitle={`${req.employee_name} · ${req.department_name || "-"}`}
          action={
            <div className="flex gap-2 items-center">
              <Badge className={STATUS_COLOR[req.status]} data-testid="request-status">{STATUS_LABEL[req.status]}</Badge>
              {req.status === "APPROVED" && <Button size="sm" variant="outline" onClick={downloadPdf} data-testid="download-pdf-button"><FileDown size={15} className="mr-1.5" /> PDF</Button>}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Detalii cerere</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Angajat" value={req.employee_name} />
            <Row label="Email" value={req.employee_email} />
            <Row label="Departament" value={req.department_name || "-"} />
            <Row label="Tip concediu" value={`${req.leave_type_name} (${req.leave_type_code}) ${req.leave_type_paid ? "· plătit" : "· neplătit"}`} />
            <Row label="Dată început" value={fmtDate(req.start_date)} />
            <Row label="Dată sfârșit" value={fmtDate(req.end_date)} />
            <Row label="Zile lucrătoare" value={<strong>{req.working_days}</strong>} />
            <Row label="Creată" value={fmtDate(req.created_at)} />
            {req.attachments?.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-2">Atașamente</div>
                {req.attachments.map((a) => (
                  <button key={a.id} onClick={() => downloadAttachment(a.id, a.file_name)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800" data-testid={`attachment-${a.id}`}>
                    <Paperclip size={14} /> {a.file_name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Istoric workflow</CardTitle></CardHeader>
          <CardContent className="space-y-3" data-testid="workflow-history">
            {wf.map((w) => (
              <div key={w.id} className="flex gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><Clock size={12} /></div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500">{fmtDate(w.changed_at)}</div>
                  <div className="text-sm"><strong>{w.user_name}</strong> — {w.old_status} → <strong>{w.current_status}</strong></div>
                  {w.comment && <div className="text-xs text-slate-600 mt-1 bg-slate-50 rounded p-2">💬 {w.comment}</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(canApprove || canCancel || canSubmit) && (
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Acțiuni</CardTitle></CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            {canSubmit && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => action("SUBMIT")} data-testid="submit-request-button">
                <Send size={15} className="mr-1.5" /> Trimite spre aprobare
              </Button>
            )}
            {canApprove && (
              <>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => action("APPROVE")} data-testid="approve-button">
                  <CheckCircle2 size={15} className="mr-1.5" /> Aprobă
                </Button>
                <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setRejectOpen(true)} data-testid="reject-button">
                  <XCircle size={15} className="mr-1.5" /> Respinge
                </Button>
              </>
            )}
            {canCancel && (
              <Button variant="outline" onClick={() => action("CANCEL")} data-testid="cancel-request-button">
                <XOctagon size={15} className="mr-1.5" /> Anulează
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Respinge cererea</DialogTitle></DialogHeader>
          <div>
            <Label>Motiv (obligatoriu)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} data-testid="reject-comment" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Anulează</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doReject} data-testid="reject-confirm">Respinge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center py-1">
      <div className="w-40 text-slate-500 text-xs uppercase tracking-wide">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}
