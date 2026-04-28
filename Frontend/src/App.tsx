import { useEffect } from "react";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { store } from "@/app/store";
import { setupApiClient } from "@/api/axios";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/common/EmptyState";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
setupApiClient(store, API_BASE);

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<EmptyState label="Dashboard" />} />
          <Route path="/tasks" element={<EmptyState label="Tasks" />} />
          <Route path="/messages" element={<EmptyState label="Messages" />} />
          <Route path="/attendance" element={<EmptyState label="Attendance" />} />
          <Route path="/expenses" element={<EmptyState label="Expenses" />} />
          <Route path="/payroll" element={<EmptyState label="Payroll" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    document.title = "SMS-IP — Employee Management";
  }, []);
  return (
    <Provider store={store}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routed />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </Provider>
  );
}
