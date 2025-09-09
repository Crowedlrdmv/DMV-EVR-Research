import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SystemHealth {
  api: { status: string; responseTime: number };
  database: { status: string; connectionCount: number };
  queue: { status: string; type: string; jobs: { waiting: number; active: number; completed: number; failed: number } };
  storage: { type: string; usage: string };
}

interface RecentActivity {
  timestamp: string;
  type: 'job' | 'error' | 'api' | 'system';
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: string;
}

export default function DiagnosticsPanel() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["/api/diagnostics/health"],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["/api/diagnostics/activity"],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'offline':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityIcon = (type: string, level: string) => {
    const levelColors = {
      success: 'text-green-600',
      info: 'text-blue-600', 
      warning: 'text-yellow-600',
      error: 'text-red-600'
    };

    const typeIcons = {
      job: 'fas fa-cog',
      error: 'fas fa-exclamation-triangle',
      api: 'fas fa-exchange-alt',
      system: 'fas fa-server'
    };

    return `${typeIcons[type as keyof typeof typeIcons] || 'fas fa-info'} ${levelColors[level as keyof typeof levelColors] || 'text-gray-600'}`;
  };

  const systemHealth = health as SystemHealth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">System Diagnostics</h2>
          <p className="text-muted-foreground">Real-time system health and activity monitoring</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="toggle-auto-refresh"
          >
            <i className={`fas fa-${autoRefresh ? 'pause' : 'play'} mr-2`}></i>
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchHealth();
            }}
            data-testid="refresh-diagnostics"
          >
            <i className="fas fa-sync-alt mr-2"></i>
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="health" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-4">
          {healthLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading system health...</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* API Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <i className="fas fa-server mr-2"></i>
                    API Server
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge className={getStatusColor(systemHealth?.api?.status || 'unknown')}>
                      {systemHealth?.api?.status || 'Unknown'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Response Time: {systemHealth?.api?.responseTime || 0}ms
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <i className="fas fa-database mr-2"></i>
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge className={getStatusColor(systemHealth?.database?.status || 'unknown')}>
                      {systemHealth?.database?.status || 'Unknown'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Connections: {systemHealth?.database?.connectionCount || 0}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Queue Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <i className="fas fa-tasks mr-2"></i>
                    Job Queue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge className={getStatusColor(systemHealth?.queue?.status || 'unknown')}>
                      {systemHealth?.queue?.type || 'Unknown'} Queue
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Active: {systemHealth?.queue?.jobs?.active || 0} | 
                      Waiting: {systemHealth?.queue?.jobs?.waiting || 0}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Storage Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <i className="fas fa-hdd mr-2"></i>
                    Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge className="bg-blue-100 text-blue-800">
                      {systemHealth?.storage?.type || 'Database'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Usage: {systemHealth?.storage?.usage || 'Unknown'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <i className="fas fa-history text-blue-600"></i>
                <span>System Activity Log</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading activity...</div>
                </div>
              ) : (activity as RecentActivity[])?.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {((activity as RecentActivity[]) || []).map((item: RecentActivity, index: number) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white`}>
                        <i className={`${getActivityIcon(item.type, item.level)} text-sm`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {item.type.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1">{item.message}</p>
                        {item.details && (
                          <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-history text-4xl text-muted-foreground mb-2"></i>
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Research Job Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Research Job Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Jobs Completed (24h)</span>
                    <span className="font-medium">{systemHealth?.queue?.jobs?.completed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Jobs Failed (24h)</span>
                    <span className="font-medium text-red-600">{systemHealth?.queue?.jobs?.failed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-medium text-green-600">
                      {systemHealth?.queue?.jobs?.completed && systemHealth?.queue?.jobs?.failed ? 
                        Math.round((systemHealth.queue.jobs.completed / (systemHealth.queue.jobs.completed + systemHealth.queue.jobs.failed)) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">API Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg Response Time</span>
                    <span className="font-medium">{systemHealth?.api?.responseTime || 0}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">API Status</span>
                    <Badge className={getStatusColor(systemHealth?.api?.status || 'unknown')}>
                      {systemHealth?.api?.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}