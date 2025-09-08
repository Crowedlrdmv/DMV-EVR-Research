import AppHeader from "@/components/layout/app-header";
import Sidebar from "@/components/layout/sidebar";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import ResearchControls from "@/components/research/research-controls";
import ResearchJobsTable from "@/components/research/research-jobs-table";
import ResearchResultsTable from "@/components/research/research-results-table";
import ResearchSummaryCards from "@/components/research/research-summary-cards";

export default function Research() {
  const [location, setLocation] = useLocation();
  
  // Get URL search params for state management
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedStates, setSelectedStates] = useState<string[]>(
    urlParams.get('states')?.split(',') || ['CA', 'TX', 'WA', 'NY']
  );
  const [selectedDataTypes, setSelectedDataTypes] = useState<Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>>(
    (urlParams.get('dataTypes')?.split(',') as Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>) || ['rules', 'emissions']
  );
  const [depth, setDepth] = useState<'summary' | 'full'>(
    (urlParams.get('depth') as 'summary' | 'full') || 'summary'
  );

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedStates.length > 0) params.set('states', selectedStates.join(','));
    if (selectedDataTypes.length > 0) params.set('dataTypes', selectedDataTypes.join(','));
    params.set('depth', depth);
    
    const newUrl = `/research?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [selectedStates, selectedDataTypes, depth]);

  // Navigate to analytics with current filters
  const handleViewInAnalytics = () => {
    const params = new URLSearchParams();
    if (selectedStates.length > 0) {
      params.set('states', selectedStates.join(','));
    }
    if (selectedDataTypes.length > 0) {
      params.set('types', selectedDataTypes.join(','));
    }
    
    const analyticsUrl = `/analytics?${params.toString()}`;
    setLocation(analyticsUrl);
  };

  return (
    <div className="bg-background font-sans antialiased min-h-screen">
      <AppHeader />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="research-title">
                Research Pipeline
              </h1>
              <p className="text-muted-foreground">
                Run automated research on state DMV compliance programs and view results
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              <i className="fas fa-flask mr-2"></i>
              Pipeline Ready
            </Badge>
          </div>

          {/* Research Summary Cards */}
          <ErrorBoundary>
            <ResearchSummaryCards />
          </ErrorBoundary>

          <Separator />

          {/* Controls Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Research Controls</h2>
            <ErrorBoundary>
              <ResearchControls
                selectedStates={selectedStates}
                setSelectedStates={setSelectedStates}
                selectedDataTypes={selectedDataTypes}
                setSelectedDataTypes={setSelectedDataTypes}
                depth={depth}
                setDepth={setDepth}
              />
            </ErrorBoundary>
          </div>

          <Separator />

          {/* Job Status Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Job Status</h2>
              <Badge variant="secondary" className="text-xs">
                Last 25 Jobs
              </Badge>
            </div>
            <ErrorBoundary>
              <ResearchJobsTable />
            </ErrorBoundary>
          </div>

          <Separator />

          {/* Results Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Research Results</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleViewInAnalytics}
                data-testid="button-view-analytics"
              >
                <i className="fas fa-external-link-alt mr-2"></i>
                View in Analytics
              </Button>
            </div>
            <ErrorBoundary>
              <ResearchResultsTable />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}