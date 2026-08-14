import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import MyRequestsPage from "@/pages/MyRequestsPage";
import TeamRequestsPage from "@/pages/TeamRequestsPage";
import AllRequestsPage from "@/pages/AllRequestsPage";
import UsersPage from "@/pages/UsersPage";
import DepartmentsPage from "@/pages/DepartmentsPage";
import LeaveTypesPage from "@/pages/LeaveTypesPage";
import CalendarPage from "@/pages/CalendarPage";
import RequestDetailPage from "@/pages/RequestDetailPage";
import { Toaster } from "sonner";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500 text-sm">Se încarcă…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={<Protected><Layout /></Protected>}
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="my-requests" element={<MyRequestsPage />} />
            <Route path="requests/:id" element={<RequestDetailPage />} />
            <Route path="team-requests" element={<Protected roles={["DEPT_RESP", "ADMIN"]}><TeamRequestsPage /></Protected>} />
            <Route path="all-requests" element={<Protected roles={["ADMIN"]}><AllRequestsPage /></Protected>} />
            <Route path="users" element={<Protected roles={["ADMIN"]}><UsersPage /></Protected>} />
            <Route path="departments" element={<Protected roles={["ADMIN"]}><DepartmentsPage /></Protected>} />
            <Route path="leave-types" element={<Protected roles={["ADMIN"]}><LeaveTypesPage /></Protected>} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
