import AppHeader from "@/components/layout/app-header";
import Sidebar from "@/components/layout/sidebar";
import DashboardHeader from "@/components/dashboard/header";
import MetricsGrid from "@/components/dashboard/metrics-grid";
import ChartsSection from "@/components/dashboard/charts-section";
import DataIngestionPanel from "@/components/dashboard/data-ingestion-panel";
import VerificationPanel from "@/components/dashboard/verification-panel";
import ExportPanel from "@/components/dashboard/export-panel";

export default function Dashboard() {
  return (
    <div className="bg-background font-sans antialiased min-h-screen">
      <AppHeader />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 p-6 space-y-6">
          <DashboardHeader />
          <MetricsGrid />
          <ChartsSection />
          <DataIngestionPanel />
          <VerificationPanel />
          <ExportPanel />
        </main>
      </div>
    </div>
  );
}
