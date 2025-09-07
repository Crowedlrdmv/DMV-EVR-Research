import { useQuery } from "@tanstack/react-query";

export default function Sidebar() {
  const { data: summary } = useQuery({
    queryKey: ["/api/analytics/summary"],
  });

  return (
    <aside className="w-64 bg-card border-r border-border">
      <div className="p-6">
        <nav className="space-y-2">
          <a 
            href="#dashboard" 
            className="flex items-center space-x-3 px-3 py-2 bg-primary text-primary-foreground rounded-md font-medium"
            data-testid="sidebar-dashboard"
          >
            <i className="fas fa-tachometer-alt w-4"></i>
            <span>Dashboard</span>
          </a>
          <a 
            href="#ingestion" 
            className="flex items-center space-x-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md font-medium transition-colors"
            data-testid="sidebar-ingestion"
          >
            <i className="fas fa-upload w-4"></i>
            <span>Data Ingestion</span>
          </a>
          <a 
            href="#analytics" 
            className="flex items-center space-x-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md font-medium transition-colors"
            data-testid="sidebar-analytics"
          >
            <i className="fas fa-chart-bar w-4"></i>
            <span>Analytics</span>
          </a>
          <a 
            href="#verification" 
            className="flex items-center space-x-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md font-medium transition-colors"
            data-testid="sidebar-verification"
          >
            <i className="fas fa-shield-alt w-4"></i>
            <span>AI Verification</span>
          </a>
          <a 
            href="#exports" 
            className="flex items-center space-x-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md font-medium transition-colors"
            data-testid="sidebar-exports"
          >
            <i className="fas fa-file-excel w-4"></i>
            <span>Export Data</span>
          </a>
        </nav>

        {/* Database Status */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold text-foreground mb-2">Database Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Prisma ORM</span>
              <span className="text-green-600 font-medium" data-testid="prisma-status">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Knex.js</span>
              <span className="text-green-600 font-medium" data-testid="knex-status">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Records</span>
              <span className="text-foreground font-medium" data-testid="record-count">
                {(summary as any)?.metrics?.totalRecords || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
