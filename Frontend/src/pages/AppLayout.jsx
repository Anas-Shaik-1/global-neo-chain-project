// pages/AppLayout.jsx
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Dashboard from "../components/Dashboard";

export default function AppLayout({ onLogout }) {
  return (
    <div className="flex h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <Sidebar onLogout={onLogout} />

      <div className="flex-1 flex flex-col">
        <Topbar />
        <div className="p-6 overflow-y-auto">
          <Dashboard />
        </div>
      </div>
    </div>
  );
}
