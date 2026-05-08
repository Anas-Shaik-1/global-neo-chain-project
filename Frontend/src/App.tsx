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
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { RequestResetPage } from "@/features/auth/pages/RequestResetPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { ChangePasswordPage } from "@/features/auth/pages/ChangePasswordPage";
import { SecurityPage } from "@/features/auth/pages/SecurityPage";
import { VerifyEmailPage } from "@/features/auth/pages/VerifyEmailPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/common/EmptyState";
import { ProfilePage } from "@/features/employees/pages/ProfilePage";
import { PeopleListPage } from "@/features/employees/pages/PeopleListPage";
import { EmployeeDetailPage } from "@/features/employees/pages/EmployeeDetailPage";
import { CandidatesPage } from "@/features/employees/pages/CandidatesPage";
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
import { BugsPage } from "@/features/bugs/pages/BugsPage";
import { FeedbackPage } from "@/features/feedback/pages/FeedbackPage";
import { CalendarPage } from "@/features/calendar/pages/CalendarPage";
import { RoleGate } from "@/features/auth/RoleGate";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ScrollToHash } from "@/components/common/ScrollToHash";
import { LandingPage } from "@/features/landing/LandingPage";
import { TeamPage } from "@/features/landing/pages/TeamPage";
import { ServicesPage } from "@/features/landing/pages/ServicesPage";
import { IndustriesPage } from "@/features/landing/pages/IndustriesPage";
import { AboutPage } from "@/features/landing/pages/AboutPage";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
setupApiClient(store, API_BASE);

function Routed() {
  return (
    <Routes>
      {/* Public marketing landing — bounces logged-in users to /dashboard
          internally so the URL stays stable for shareable links. */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/industries" element={<IndustriesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<RequestResetPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/people" element={<PeopleListPage />} />
          <Route
            path="/people/candidates"
            element={
              <RoleGate
                roles={["HR", "ADMIN"]}
                fallback={<EmptyState label="Forbidden" hint="HR or Admin only." />}
              >
                <CandidatesPage />
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
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
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
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <Toaster richColors position="top-right" theme="dark" closeButton />
            <BrowserRouter>
              <ScrollToHash />
              <CallProvider>
                <Routed />
                <IncomingCallDialog />
                <CallView />
              </CallProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}
