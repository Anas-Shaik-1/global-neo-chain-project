import { useEffect } from "react";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { store } from "@/app/store";
import { setupApiClient } from "@/api/axios";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequestResetPage } from "@/features/auth/pages/RequestResetPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { ChangePasswordPage } from "@/features/auth/pages/ChangePasswordPage";
import { SecurityPage } from "@/features/auth/pages/SecurityPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/common/EmptyState";
import { ProfilePage } from "@/features/employees/pages/ProfilePage";
import { PeopleListPage } from "@/features/employees/pages/PeopleListPage";
import { EmployeeDetailPage } from "@/features/employees/pages/EmployeeDetailPage";
import { CreateEmployeePage } from "@/features/employees/pages/CreateEmployeePage";
import { DepartmentsPage } from "@/features/employees/pages/DepartmentsPage";
import { AttendancePage } from "@/features/attendance/pages/AttendancePage";
import { TasksPage } from "@/features/tasks/pages/TasksPage";
import { ExpensesPage } from "@/features/expenses/pages/ExpensesPage";
import { PayrollPage } from "@/features/payroll/pages/PayrollPage";
import { MessagesPage } from "@/features/chat/pages/MessagesPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { CallsHistoryPage } from "@/features/calls/pages/CallsHistoryPage";
import { CallProvider } from "@/features/calls/CallProvider";
import { IncomingCallDialog } from "@/features/calls/components/IncomingCallDialog";
import { CallView } from "@/features/calls/components/CallView";
import { RoleGate } from "@/features/auth/RoleGate";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
setupApiClient(store, API_BASE);

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<RequestResetPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/people" element={<PeopleListPage />} />
          <Route
            path="/people/new"
            element={
              <RoleGate roles={["HR", "ADMIN"]} fallback={<EmptyState label="Forbidden" hint="HR or Admin only." />}>
                <CreateEmployeePage />
              </RoleGate>
            }
          />
          <Route path="/people/:id" element={<EmployeeDetailPage />} />
          <Route
            path="/departments"
            element={
              <RoleGate roles={["HR", "ADMIN"]} fallback={<EmptyState label="Forbidden" hint="HR or Admin only." />}>
                <DepartmentsPage />
              </RoleGate>
            }
          />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/calls" element={<CallsHistoryPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    document.title = "Global NeoChain — Employee Management";
  }, []);
  return (
    <Provider store={store}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Toaster richColors position="top-right" theme="dark" closeButton />
          <BrowserRouter>
            <CallProvider>
              <Routed />
              <IncomingCallDialog />
              <CallView />
            </CallProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </Provider>
  );
}
