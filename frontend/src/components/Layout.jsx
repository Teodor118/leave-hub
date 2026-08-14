import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABEL } from "@/lib/api";
import {
  LayoutDashboard, FileText, ClipboardCheck, Files, Users, Building2,
  Tags, Calendar, LogOut, Palmtree
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/dashboard", label: "Panou principal", icon: LayoutDashboard, roles: ["USER", "DEPT_RESP", "ADMIN"], tid: "nav-dashboard" },
  { to: "/my-requests", label: "Cererile mele", icon: FileText, roles: ["USER", "DEPT_RESP", "ADMIN"], tid: "nav-my-requests" },
  { to: "/team-requests", label: "Cereri echipă", icon: ClipboardCheck, roles: ["DEPT_RESP", "ADMIN"], tid: "nav-team-requests" },
  { to: "/all-requests", label: "Toate cererile", icon: Files, roles: ["ADMIN"], tid: "nav-all-requests" },
  { to: "/calendar", label: "Calendar", icon: Calendar, roles: ["USER", "DEPT_RESP", "ADMIN"], tid: "nav-calendar" },
  { to: "/users", label: "Angajați", icon: Users, roles: ["ADMIN"], tid: "nav-users" },
  { to: "/departments", label: "Departamente", icon: Building2, roles: ["ADMIN"], tid: "nav-departments" },
  { to: "/leave-types", label: "Tipuri de concediu", icon: Tags, roles: ["ADMIN"], tid: "nav-leave-types" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Palmtree size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Leave Hub</div>
            <div className="text-xs text-slate-500">DRAXLMAIER</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} data-testid={n.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}>
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-2 pb-3">
            <div className="text-sm font-medium text-slate-800 truncate" data-testid="current-user-name">{user.name}</div>
            <div className="text-xs text-slate-500 truncate mt-0.5" data-testid="current-user-email">{user.email}</div>
            <Badge className="mt-2 bg-blue-100 text-blue-800 hover:bg-blue-100" data-testid="current-user-role">{ROLE_LABEL[user.role]}</Badge>
            {user.role === "USER" && (
              <div className="mt-3 text-xs text-slate-600" data-testid="user-balance-sidebar">
                Sold zile: <strong>{user.available_leave_days}</strong> / {user.annual_leave_days}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start" data-testid="logout-button"
            onClick={() => { logout(); navigate("/login"); }}>
            <LogOut size={15} className="mr-2" /> Deconectare
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto"><Outlet /></div>
      </main>
    </div>
  );
}
