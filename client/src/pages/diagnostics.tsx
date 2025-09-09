import AppHeader from "@/components/layout/app-header";
import Sidebar from "@/components/layout/sidebar";
import DiagnosticsPanel from "@/components/diagnostics/diagnostics-panel";

export default function Diagnostics() {
  return (
    <div className="bg-background font-sans antialiased min-h-screen">
      <AppHeader />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 p-6">
          <DiagnosticsPanel />
        </main>
      </div>
    </div>
  );
}