import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ExportPanel() {
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [includeFields, setIncludeFields] = useState({
    vehicleId: true,
    complianceStatus: true,
    expiryDate: true,
    verificationTimestamp: false,
  });

  const { toast } = useToast();

  const { data: summary } = useQuery({
    queryKey: ["/api/analytics/summary"],
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

  const handleFieldChange = (field: string, checked: boolean) => {
    setIncludeFields(prev => ({
      ...prev,
      [field]: checked,
    }));
  };

  const recordCount = (summary as any)?.metrics?.totalRecords || 0;
  const estimatedSize = recordCount < 100 ? "< 1 KB" : 
                      recordCount < 1000 ? "< 10 KB" : 
                      recordCount < 10000 ? "< 100 KB" : "< 1 MB";

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Data Export</h3>
          <div className="flex items-center space-x-2">
            <i className="fas fa-file-excel text-green-600"></i>
            <span className="text-sm text-muted-foreground">Excel streaming enabled</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Export Configuration</h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="export-format" className="text-sm font-medium text-foreground mb-1">
                  Export Format
                </Label>
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
              <div>
                <Label className="text-sm font-medium text-foreground mb-1">Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-1">Include Fields</Label>
                <div className="space-y-2">
                  {Object.entries(includeFields).map(([field, checked]) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={checked}
                        onCheckedChange={(checked) => handleFieldChange(field, checked as boolean)}
                        data-testid={`checkbox-${field}`}
                      />
                      <Label htmlFor={field} className="text-sm text-foreground capitalize">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Export Actions</h4>
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Export Preview</p>
                <p className="text-lg font-semibold text-foreground" data-testid="record-count">
                  {recordCount} records
                </p>
                <p className="text-sm text-muted-foreground" data-testid="file-size">
                  estimated file size: {estimatedSize}
                </p>
              </div>
              <div className="space-y-2">
                <Button 
                  className="w-full"
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending}
                  data-testid="button-generate-report"
                >
                  <i className="fas fa-download mr-2"></i>
                  {exportMutation.isPending ? "Generating..." : "Generate Report"}
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  data-testid="button-schedule-export"
                >
                  <i className="fas fa-clock mr-2"></i>
                  Schedule Export
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  data-testid="button-preview-data"
                >
                  <i className="fas fa-eye mr-2"></i>
                  Preview Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
