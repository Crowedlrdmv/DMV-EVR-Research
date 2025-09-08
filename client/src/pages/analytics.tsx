import AppHeader from "@/components/layout/app-header";
import Sidebar from "@/components/layout/sidebar";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Chart, type ChartConfiguration, registerables } from "chart.js";

Chart.register(...registerables);

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");
  const [viewType, setViewType] = useState("daily");
  const complianceChartRef = useRef<HTMLCanvasElement>(null);
  const volumeChartRef = useRef<HTMLCanvasElement>(null);
  const regionChartRef = useRef<HTMLCanvasElement>(null);
  const complianceChartInstance = useRef<Chart | null>(null);
  const volumeChartInstance = useRef<Chart | null>(null);
  const regionChartInstance = useRef<Chart | null>(null);

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["/api/analytics/trends", { days: timeRange }],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/analytics/summary"],
  });

  // Get URL search params to filter by research state/types from the Research page
  const urlParams = new URLSearchParams(window.location.search);
  const filterStates = urlParams.get('states')?.split(',') || [];
  const filterTypes = urlParams.get('types')?.split(',') || [];

  // Compliance Trends Chart
  useEffect(() => {
    if (!trends || trendsLoading) return;

    if (complianceChartRef.current) {
      if (complianceChartInstance.current) {
        complianceChartInstance.current.destroy();
      }

      const ctx = complianceChartRef.current.getContext("2d");
      if (ctx) {
        const hasData = (trends as any)?.compliance?.data?.length > 0;
        const config: ChartConfiguration = {
          type: "line",
          data: {
            labels: hasData ? (trends as any).compliance.labels : ["No Data"],
            datasets: [{
              label: "Compliance Rate",
              data: hasData ? (trends as any).compliance.data : [0],
              borderColor: "hsl(221.2, 83.2%, 53.3%)",
              backgroundColor: "hsla(221.2, 83.2%, 53.3%, 0.1)",
              tension: 0.4,
              fill: true,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                grid: {
                  color: "hsl(214.3, 31.8%, 91.4%)",
                },
              },
              x: {
                grid: {
                  color: "hsl(214.3, 31.8%, 91.4%)",
                },
              },
            },
          },
        };
        complianceChartInstance.current = new Chart(ctx, config);
      }
    }
  }, [trends, trendsLoading]);

  // Data Volume Chart
  useEffect(() => {
    if (!trends || trendsLoading) return;

    if (volumeChartRef.current) {
      if (volumeChartInstance.current) {
        volumeChartInstance.current.destroy();
      }

      const ctx = volumeChartRef.current.getContext("2d");
      if (ctx) {
        const hasData = (trends as any)?.volume?.data?.length > 0;
        const config: ChartConfiguration = {
          type: "bar",
          data: {
            labels: hasData ? (trends as any).volume.labels : ["No Data"],
            datasets: [{
              label: "Records Ingested",
              data: hasData ? (trends as any).volume.data : [0],
              backgroundColor: "hsl(142.1, 76.2%, 36.3%)",
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  color: "hsl(214.3, 31.8%, 91.4%)",
                },
              },
              x: {
                grid: {
                  color: "hsl(214.3, 31.8%, 91.4%)",
                },
              },
            },
          },
        };
        volumeChartInstance.current = new Chart(ctx, config);
      }
    }
  }, [trends, trendsLoading]);

  // Region Breakdown Chart (dummy data for demonstration)
  useEffect(() => {
    if (regionChartRef.current) {
      if (regionChartInstance.current) {
        regionChartInstance.current.destroy();
      }

      const ctx = regionChartRef.current.getContext("2d");
      if (ctx) {
        const totalRecords = (summary as any)?.metrics?.totalRecords || 0;
        const hasData = totalRecords > 0;
        
        const config: ChartConfiguration = {
          type: "doughnut",
          data: {
            labels: hasData ? ["California", "Texas", "Florida", "New York", "Other"] : ["No Data"],
            datasets: [{
              data: hasData ? [35, 20, 15, 12, 18] : [1],
              backgroundColor: hasData ? [
                "hsl(221.2, 83.2%, 53.3%)",
                "hsl(142.1, 76.2%, 36.3%)",
                "hsl(47.9, 95.8%, 53.1%)",
                "hsl(0, 72.2%, 50.6%)",
                "hsl(262.1, 83.3%, 57.8%)"
              ] : ["hsl(214.3, 31.8%, 91.4%)"],
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "right",
              },
            },
          },
        };
        regionChartInstance.current = new Chart(ctx, config);
      }
    }
  }, [summary, summaryLoading]);

  // Cleanup charts on unmount
  useEffect(() => {
    return () => {
      if (complianceChartInstance.current) {
        complianceChartInstance.current.destroy();
      }
      if (volumeChartInstance.current) {
        volumeChartInstance.current.destroy();
      }
      if (regionChartInstance.current) {
        regionChartInstance.current.destroy();
      }
    };
  }, []);

  const totalRecords = (summary as any)?.metrics?.totalRecords || 0;

  return (
    <div className="bg-background font-sans antialiased min-h-screen">
      <AppHeader />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="analytics-title">
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">
                Comprehensive insights into compliance data and trends
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={timeRange} onValueChange={setTimeRange} data-testid="select-time-range">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" data-testid="button-refresh">
                <i className="fas fa-refresh mr-2"></i>
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Key Metrics */}
          {!summaryLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="metric-total-records">
                    {(summary as any)?.metrics?.totalRecords?.toLocaleString() || "0"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="metric-compliance-rate">
                    {(summary as any)?.metrics?.complianceRate || "0%"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Failed Verifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="metric-failed-verifications">
                    {(summary as any)?.metrics?.failedVerifications || "0"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">API Calls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="metric-api-calls">
                    {(summary as any)?.metrics?.apiCalls || "0"}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Rate Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full relative" data-testid="chart-compliance-trends">
                  {trendsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">Loading chart data...</div>
                    </div>
                  ) : totalRecords === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <i className="fas fa-chart-line text-4xl text-muted-foreground mb-2"></i>
                        <p className="text-muted-foreground">No compliance data available</p>
                        <p className="text-sm text-muted-foreground">Start ingesting data to see trends</p>
                      </div>
                    </div>
                  ) : (
                    <canvas ref={complianceChartRef}></canvas>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Data Volume */}
            <Card>
              <CardHeader>
                <CardTitle>Data Ingestion Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full relative" data-testid="chart-ingestion-volume">
                  {trendsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">Loading chart data...</div>
                    </div>
                  ) : totalRecords === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <i className="fas fa-chart-bar text-4xl text-muted-foreground mb-2"></i>
                        <p className="text-muted-foreground">No ingestion data available</p>
                        <p className="text-sm text-muted-foreground">Upload data files to track volume</p>
                      </div>
                    </div>
                  ) : (
                    <canvas ref={volumeChartRef}></canvas>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Regional Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Records by Region</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full relative" data-testid="chart-region-breakdown">
                {summaryLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">Loading chart data...</div>
                  </div>
                ) : totalRecords === 0 && !((summary as any)?.research?.totalPrograms > 0) ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <i className="fas fa-map-marked-alt text-4xl text-muted-foreground mb-2"></i>
                      <p className="text-muted-foreground">No regional data available</p>
                      <p className="text-sm text-muted-foreground">Regional breakdown will appear here once data is available</p>
                    </div>
                  </div>
                ) : (
                  <canvas ref={regionChartRef}></canvas>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Research Analytics Section */}
          {((summary as any)?.research?.totalPrograms > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* State Profiles */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-map-marker-alt text-blue-600"></i>
                    <span>State Profiles</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" data-testid="state-profiles">
                    {filterStates.length > 0 ? (
                      <div className="text-sm text-muted-foreground mb-4">
                        Filtered by states: {filterStates.join(', ')}
                      </div>
                    ) : null}
                    {Object.entries((summary as any)?.research?.programsByState || {}).map(([state, count]) => (
                      <div key={state} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-800">{state}</span>
                          </div>
                          <span className="font-medium">{state}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{count}</div>
                          <div className="text-xs text-muted-foreground">programs</div>
                        </div>
                      </div>
                    ))}
                    {Object.keys((summary as any)?.research?.programsByState || {}).length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No state data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Changes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-clock text-green-600"></i>
                    <span>Recent Changes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" data-testid="recent-changes">
                    {filterTypes.length > 0 ? (
                      <div className="text-sm text-muted-foreground mb-4">
                        Filtered by types: {filterTypes.join(', ')}
                      </div>
                    ) : null}
                    <div className="text-center py-8">
                      <i className="fas fa-history text-4xl text-muted-foreground mb-2"></i>
                      <p className="text-muted-foreground">Recent Changes Coming Soon</p>
                      <p className="text-sm text-muted-foreground">
                        Change detection between research runs will appear here
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Research Summary Cards */}
          {((summary as any)?.research?.totalPrograms > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Research Programs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="metric-research-programs">
                    {(summary as any)?.research?.totalPrograms || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Total programs discovered
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">States Covered</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="metric-states-covered">
                    {(summary as any)?.metrics?.statesCovered || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    States with research data
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Research Artifacts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600" data-testid="metric-research-artifacts">
                    {(summary as any)?.research?.totalArtifacts || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Source documents processed
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}