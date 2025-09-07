import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function DataIngestionPanel() {
  const [bearerToken, setBearerToken] = useState("sk-1234567890abcdef");
  const [showToken, setShowToken] = useState(false);
  const [dbClient, setDbClient] = useState("prisma");
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/ingestion/compliance", data, bearerToken);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload Successful",
        description: "Compliance data has been ingested",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/verify", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Validation Complete",
        description: `Data ${result.verified ? "passed" : "failed"} validation`,
        variant: result.verified ? "default" : "destructive",
      });
    },
  });

  const handleFileSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            uploadMutation.mutate(data);
          } catch (error) {
            toast({
              title: "Invalid File",
              description: "Please select a valid JSON file",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleValidate = () => {
    const testData = {
      vehicle_id: "ABC123",
      compliance_status: "valid",
      expiry_date: "2024-12-31"
    };
    validateMutation.mutate(testData);
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Data Ingestion</h3>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
              Bearer Token Active
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Authentication Panel */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Authentication Configuration</h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="bearer-token" className="text-sm font-medium text-foreground mb-1">
                  Bearer Token
                </Label>
                <div className="flex">
                  <Input
                    id="bearer-token"
                    type={showToken ? "text" : "password"}
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder="Enter bearer token"
                    className="rounded-r-none"
                    data-testid="input-bearer-token"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowToken(!showToken)}
                    className="rounded-l-none border-l-0"
                    data-testid="button-toggle-token"
                  >
                    <i className={`fas ${showToken ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Required for /api/ingestion endpoints
                </p>
              </div>
              <div>
                <Label htmlFor="db-client" className="text-sm font-medium text-foreground mb-1">
                  Database Client
                </Label>
                <Select value={dbClient} onValueChange={setDbClient} data-testid="select-db-client">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prisma">Prisma ORM</SelectItem>
                    <SelectItem value="knex">Knex.js</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Data Upload Panel */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Upload Compliance Data</h4>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <i className="fas fa-cloud-upload-alt text-4xl text-muted-foreground mb-4"></i>
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop JSON files here, or
              </p>
              <Button 
                onClick={handleFileSelect}
                disabled={uploadMutation.isPending}
                data-testid="button-select-file"
              >
                Select Files
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Supports JSON format only</p>
            </div>
            <div className="flex space-x-3">
              <Button 
                className="flex-1" 
                disabled={uploadMutation.isPending}
                onClick={handleFileSelect}
                data-testid="button-upload-data"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Data"}
              </Button>
              <Button 
                variant="secondary"
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                data-testid="button-validate-data"
              >
                {validateMutation.isPending ? "Validating..." : "Validate"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
