import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

export const http = axios.create({ baseURL: API });
http.interceptors.request.use((c) => {
  const t = localStorage.getItem("token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export function formatApiErr(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "A apărut o eroare";
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (typeof d?.msg === "string") return d.msg;
  return String(d);
}

export const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
};

export const ROLE_LABEL = { USER: "Angajat", DEPT_RESP: "Manager departament", ADMIN: "Administrator" };

export const STATUS_LABEL = {
  DRAFT: "Ciornă", PENDING: "În așteptare", APPROVED: "Aprobată",
  REJECTED: "Respinsă", CANCELLED: "Anulată",
};
export const STATUS_COLOR = {
  DRAFT: "bg-slate-200 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-300 text-slate-700",
};
