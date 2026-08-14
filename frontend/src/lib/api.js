import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

export const http = axios.create({ baseURL: API });

http.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
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

export const fmtRON = (v) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 2 })
    .format(Number(v || 0));

export const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
};
