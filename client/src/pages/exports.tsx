import AppHeader from "@/components/layout/app-header";
import Sidebar from "@/components/layout/sidebar";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Exports() {
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [includeFields, setIncludeFields] = useState({
    vehicleId: true,
    complianceStatus: true,
    expiryDate: true,
    verificationTimestamp: false,
  });
  const [scheduleFrequency, setScheduleFrequency] = useState("daily");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  const { toast } = useToast();

  const { data: summary } = useQuery({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["/api/verifications/recent"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/export");
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance_records.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Report has been downloaded successfully",
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

  const scheduleExportMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      // This would typically call a backend API to schedule the export
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      return scheduleData;
    },
    onSuccess: () => {
      toast({
        title: "Export Scheduled",
        description: `Report will be generated ${scheduleFrequency} at ${scheduleTime}`,
      });
      setShowScheduleDialog(false);
    },
    onError: () => {
      toast({
        title: "Scheduling Failed",
        description: "Unable to schedule export",
        variant: "destructive",
      });
    },
  });

  const handleFieldChange = (field: string, checked: boolean) => {
    setIncludeFields(prev => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleScheduleExport = () => {
    if (recordCount === 0) {
      toast({
        title: "⚠️ No Data Available",
        description: "Cannot schedule exports - no records to export. Please ingest data first.",
        variant: "destructive",
      });
      return;
    }
    
    const scheduleData = {
      frequency: scheduleFrequency,
      time: scheduleTime,
      format: exportFormat,
      fields: includeFields,
      dateRange: { startDate, endDate }
    };
    scheduleExportMutation.mutate(scheduleData);
  };

  const recordCount = (summary as any)?.metrics?.totalRecords || 0;
  const estimatedSize = recordCount < 100 ? "< 1 KB" : 
                      recordCount < 1000 ? "< 10 KB" : 
                      recordCount < 10000 ? "< 100 KB" : "< 1 MB";

  const previewData = Array.isArray(recentRecords) ? recentRecords.slice(0, 5) : [];

  return (
    <TooltipProvider>
      <div className="bg-background font-sans antialiased min-h-screen">
        <AppHeader />
        <div className="flex min-h-[calc(100vh-4rem)]">
          <Sidebar />
          <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="exports-title">
                Data Export
              </h1>
              <p className="text-muted-foreground">
                Export compliance data and schedule automated reports
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-file-excel text-green-600"></i>
              <span className="text-sm text-muted-foreground">Excel streaming enabled</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Export Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Export Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Format Selection */}
                <div>
                  <Label htmlFor="export-format">Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat} data-testid="select-export-format">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                      <SelectItem value="json">JSON (.json)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                {/* Field Selection */}
                <div>
                  <Label>Include Fields</Label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(includeFields).map(([field, checked]) => (
                      <div key={field} className="flex items-center space-x-2">
                        <Checkbox
                          id={field}
                          checked={checked}
                          onCheckedChange={(checked) => handleFieldChange(field, !!checked)}
                          data-testid={`checkbox-${field}`}
                        />
                        <Label htmlFor={field} className="text-sm">
                          {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Export Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Export Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Records to Export</span>
                    <Badge variant="secondary" data-testid="badge-record-count">
                      {recordCount.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Estimated File Size</span>
                    <span className="text-sm font-medium" data-testid="text-estimated-size">{estimatedSize}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Selected Fields</span>
                    <span className="text-sm font-medium">
                      {Object.values(includeFields).filter(Boolean).length} of {Object.keys(includeFields).length}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending || recordCount === 0}
                    data-testid="button-export-now"
                  >
                    <i className="fas fa-download mr-2"></i>
                    {exportMutation.isPending ? "Exporting..." : "Export Now"}
                  </Button>

                  <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled={recordCount === 0}
                        data-testid="button-preview-data"
                      >
                        <i className="fas fa-eye mr-2"></i>
                        Preview Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Data Preview</DialogTitle>
                      </DialogHeader>
                      <div className="mt-4">
                        {recordCount === 0 ? (
                          <div className="text-center py-8">
                            <i className="fas fa-inbox text-4xl text-muted-foreground mb-2"></i>
                            <p className="text-muted-foreground">No data available to preview</p>
                            <p className="text-sm text-muted-foreground">Start ingesting compliance data to see preview</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Showing first 5 records of {recordCount} total records
                            </p>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Vehicle ID</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Timestamp</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {previewData.map((record: any, index: number) => (
                                    <tr key={index} className="border-t">
                                      <td className="px-4 py-2 text-sm">{record.vehicleId || "N/A"}</td>
                                      <td className="px-4 py-2 text-sm">
                                        <Badge variant={record.status === "valid" ? "default" : "destructive"}>
                                          {record.status}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {record.timestamp ? new Date(record.timestamp).toLocaleDateString() : "N/A"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled={recordCount === 0}
                        data-testid="button-schedule-export"
                        title={recordCount === 0 ? 'No records available to schedule export' : undefined}
                      >
                        <i className="fas fa-calendar mr-2"></i>
                        Schedule Export
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Schedule Automated Export</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="frequency">Frequency</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <i className="fas fa-info-circle text-muted-foreground text-sm cursor-help"></i>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>How often the export should be automatically generated</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="schedule-time">Time</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <i className="fas fa-info-circle text-muted-foreground text-sm cursor-help"></i>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>What time of day to generate the export (24-hour format)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Input
                            id="schedule-time"
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                          />
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <h4 className="font-medium mb-2">Export Summary</h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>Format: {exportFormat.toUpperCase()}</p>
                            <p>Frequency: {scheduleFrequency}</p>
                            <p>Time: {scheduleTime}</p>
                            <p>Records: {recordCount.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2 pt-4">
                          <Button 
                            onClick={handleScheduleExport}
                            disabled={scheduleExportMutation.isPending}
                            className="flex-1"
                          >
                            {scheduleExportMutation.isPending ? "Scheduling..." : "Schedule Export"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowScheduleDialog(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {recordCount === 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-exclamation-triangle text-yellow-600"></i>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        No data available for export. Please ingest compliance data first.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Exports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Exports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <i className="fas fa-file-export text-4xl text-muted-foreground mb-2"></i>
                  <p className="text-muted-foreground">No recent exports</p>
                  <p className="text-sm text-muted-foreground">Export history will appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}