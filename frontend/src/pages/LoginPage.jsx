import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Palmtree, Loader2 } from "lucide-react";
import { formatApiErr } from "@/lib/api";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("ragemonster069@gmail.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await login(email, password); navigate("/dashboard"); }
    catch (e) { setErr(formatApiErr(e)); }
    finally { setBusy(false); }
  };

  const quickLogin = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Palmtree size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">Employee Leave Hub</div>
            <div className="text-xs text-slate-500">DRAXLMAIER — Panou intern</div>
          </div>
        </div>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Autentificare</CardTitle>
            <CardDescription>Accesați platforma cu contul companiei.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parolă</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
              </div>
              {err && <Alert variant="destructive" data-testid="login-error-message"><AlertDescription>{err}</AlertDescription></Alert>}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={busy} data-testid="login-submit-button">
                {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Autentificare
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-700 mb-2">Conturi demo</div>
          <div className="space-y-1 text-xs">
            <button className="w-full text-left px-2 py-1 rounded hover:bg-slate-100" onClick={() => quickLogin("ragemonster069@gmail.com", "admin123")} data-testid="quick-admin">Admin — ragemonster069@gmail.com</button>
            <button className="w-full text-left px-2 py-1 rounded hover:bg-slate-100" onClick={() => quickLogin("manager.it@draxlmaier.ro", "parola123")} data-testid="quick-manager">Manager IT — manager.it@draxlmaier.ro</button>
            <button className="w-full text-left px-2 py-1 rounded hover:bg-slate-100" onClick={() => quickLogin("ion.popescu@draxlmaier.ro", "parola123")} data-testid="quick-user">Angajat — ion.popescu@draxlmaier.ro</button>
          </div>
        </div>
      </div>
    </div>
  );
}
