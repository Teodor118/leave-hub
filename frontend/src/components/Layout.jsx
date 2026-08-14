import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, UserCog, MapPin, Package, CalendarCheck, CreditCard, BarChart3, LogOut, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Tablou de comandă", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/clients", label: "Clienți", icon: Users, testId: "nav-clients" },
  { to: "/employees", label: "Angajați", icon: UserCog, testId: "nav-employees" },
  { to: "/destinations", label: "Destinații", icon: MapPin, testId: "nav-destinations" },
  { to: "/packages", label: "Pachete", icon: Package, testId: "nav-packages" },
  { to: "/reservations", label: "Rezervări", icon: CalendarCheck, testId: "nav-reservations" },
  { to: "/payments", label: "Plăți", icon: CreditCard, testId: "nav-payments" },
  { to: "/reports", label: "Rapoarte", icon: BarChart3, testId: "nav-reports" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Plane size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">TurismERP</div>
            <div className="text-xs text-slate-500">Agenție de turism</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-2 pb-3">
            <div className="text-xs text-slate-500">Autentificat ca</div>
            <div className="text-sm font-medium text-slate-800 truncate" data-testid="current-user-email">
              {user?.email}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            data-testid="logout-button"
            onClick={handleLogout}
          >
            <LogOut size={15} className="mr-2" />
            Deconectare
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
