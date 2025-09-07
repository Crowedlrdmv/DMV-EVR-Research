import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Chart, ChartConfiguration } from "chart.js/auto";

export default function ChartsSection() {
  const [timeRange, setTimeRange] = useState("30");
  const [viewType, setViewType] = useState("daily");
  const complianceChartRef = useRef<HTMLCanvasElement>(null);
  const volumeChartRef = useRef<HTMLCanvasElement>(null);
  const complianceChartInstance = useRef<Chart | null>(null);
  const volumeChartInstance = useRef<Chart | null>(null);

  const { data: trends, isLoading } = useQuery({
    queryKey: ["/api/analytics/trends", { days: timeRange }],
  });

  useEffect(() => {
    if (!trends || isLoading) return;

    // Compliance Trends Chart
    if (complianceChartRef.current) {
      if (complianceChartInstance.current) {
        complianceChartInstance.current.destroy();
      }

      const ctx = complianceChartRef.current.getContext("2d");
      if (ctx) {
        const config: ChartConfiguration = {
          type: "line",
          data: {
            labels: trends.compliance?.labels || [],
            datasets: [{
              label: "Compliance Rate",
              data: trends.compliance?.data || [],
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
                display: false,
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

    // Data Volume Chart
    if (volumeChartRef.current) {
      if (volumeChartInstance.current) {
        volumeChartInstance.current.destroy();
      }

      const ctx = volumeChartRef.current.getContext("2d");
      if (ctx) {
        const config: ChartConfiguration = {
          type: "bar",
          data: {
            labels: trends.volume?.labels || [],
            datasets: [{
              label: "Records Ingested",
              data: trends.volume?.data || [],
              backgroundColor: "hsl(173, 58%, 39%)",
              borderColor: "hsl(173, 58%, 39%)",
              borderWidth: 1,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
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

    return () => {
      if (complianceChartInstance.current) {
        complianceChartInstance.current.destroy();
      }
      if (volumeChartInstance.current) {
        volumeChartInstance.current.destroy();
      }
    };
  }, [trends, isLoading]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compliance Trends Chart */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Compliance Trends</h3>
            <Select value={timeRange} onValueChange={setTimeRange} data-testid="select-time-range">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-64 flex items-center justify-center">
            {isLoading ? (
              <div className="animate-pulse bg-muted w-full h-full rounded"></div>
            ) : (
              <canvas 
                ref={complianceChartRef} 
                className="w-full h-full"
                data-testid="chart-compliance"
              ></canvas>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Volume Chart */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Data Ingestion Volume</h3>
            <div className="flex items-center space-x-2">
              <Button 
                variant={viewType === "daily" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("daily")}
                data-testid="button-daily"
              >
                Daily
              </Button>
              <Button 
                variant={viewType === "weekly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("weekly")}
                data-testid="button-weekly"
              >
                Weekly
              </Button>
              <Button 
                variant={viewType === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("monthly")}
                data-testid="button-monthly"
              >
                Monthly
              </Button>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            {isLoading ? (
              <div className="animate-pulse bg-muted w-full h-full rounded"></div>
            ) : (
              <canvas 
                ref={volumeChartRef} 
                className="w-full h-full"
                data-testid="chart-volume"
              ></canvas>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
