import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function DashboardHeader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const refreshMutation = useMutation({
    mutationFn: async () => {
      // Invalidate all queries to refresh data
      await queryClient.invalidateQueries();
    },
    onSuccess: () => {
      toast({
        title: "Data Refreshed",
        description: "Dashboard data has been updated",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/export");
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance_records.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Excel report has been downloaded",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Unable to generate report",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-foreground" data-testid="dashboard-title">
          Compliance Dashboard
        </h2>
        <p className="text-muted-foreground mt-1">
          Monitor data ingestion, compliance metrics, and system health
        </p>
      </div>
      <div className="flex items-center space-x-3">
        <Button 
          variant="secondary"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh"
        >
          <i className="fas fa-sync-alt mr-2"></i>
          {refreshMutation.isPending ? "Refreshing..." : "Refresh"}
        </Button>
        <Button 
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          data-testid="button-export"
        >
          <i className="fas fa-download mr-2"></i>
          {exportMutation.isPending ? "Exporting..." : "Export Report"}
        </Button>
      </div>
    </div>
  );
}
