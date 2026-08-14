import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import ClientsPage from "@/pages/ClientsPage";
import EmployeesPage from "@/pages/EmployeesPage";
import DestinationsPage from "@/pages/DestinationsPage";
import PackagesPage from "@/pages/PackagesPage";
import ReservationsPage from "@/pages/ReservationsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import ReportsPage from "@/pages/ReportsPage";
import { Toaster } from "sonner";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500 text-sm">Se încarcă…</div>;
  if (!user) return <Navigate to="/login" replace />;
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
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="destinations" element={<DestinationsPage />} />
            <Route path="packages" element={<PackagesPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
