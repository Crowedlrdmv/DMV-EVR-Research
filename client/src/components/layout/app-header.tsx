import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

export default function AppHeader() {
  const { data: healthStatus } = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000, // Check every 30 seconds
  });
  const [location] = useLocation();

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-car text-primary-foreground text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="app-title">
                DMV Compliance Research
              </h1>
              <p className="text-sm text-muted-foreground">
                Data Management & Analytics Platform
              </p>
            </div>
          </div>

          {/* Navigation and Auth Status */}
          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex items-center space-x-6">
              <Link 
                href="/dashboard" 
                className={`font-medium transition-colors ${
                  location === "/" || location === "/dashboard" 
                    ? "text-foreground hover:text-primary" 
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-dashboard"
              >
                Dashboard
              </Link>
              <a 
                href="#ingestion" 
                className="text-muted-foreground hover:text-primary font-medium transition-colors"
                data-testid="nav-ingestion"
              >
                Data Ingestion
              </a>
              <Link 
                href="/analytics" 
                className={`font-medium transition-colors ${
                  location === "/analytics" 
                    ? "text-foreground hover:text-primary" 
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-analytics"
              >
                Analytics
              </Link>
              <Link 
                href="/exports" 
                className={`font-medium transition-colors ${
                  location === "/exports" 
                    ? "text-foreground hover:text-primary" 
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-exports"
              >
                Exports
              </Link>
            </nav>
            
            {/* Auth Status Indicator */}
            <div className="flex items-center space-x-2 bg-muted px-3 py-1 rounded-md">
              <div className="w-2 h-2 bg-green-500 rounded-full" data-testid="auth-status"></div>
              <span className="text-sm font-medium text-muted-foreground">Authenticated</span>
            </div>

            {/* Health Status */}
            <div className="flex items-center space-x-2" data-testid="health-status">
              <i className={`fas fa-heartbeat ${(healthStatus as any)?.status === 'healthy' ? 'text-green-500' : 'text-red-500'}`}></i>
              <span className="text-sm text-muted-foreground">
                {(healthStatus as any)?.status === 'healthy' ? 'System Healthy' : 'System Issues'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
