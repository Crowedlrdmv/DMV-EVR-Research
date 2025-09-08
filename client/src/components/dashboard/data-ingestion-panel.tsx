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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      setUploadStatus('uploading');
      const response = await apiRequest("POST", "/api/ingestion/compliance", data, bearerToken);
      return response.json();
    },
    onSuccess: (result) => {
      setUploadStatus('success');
      const recordCount = Array.isArray(fileData) ? fileData.length : 1;
      toast({
        title: "✅ Upload Successful",
        description: `Successfully ingested ${recordCount} compliance record${recordCount > 1 ? 's' : ''}`,
      });
      // Clear file selection after successful upload
      setSelectedFile(null);
      setFileData(null);
    },
    onError: (error) => {
      setUploadStatus('error');
      toast({
        title: "❌ Upload Failed",
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
        title: result.verified ? "✅ Validation Passed" : "❌ Validation Failed",
        description: result.details || result.reason || `Data ${result.verified ? "passed" : "failed"} validation`,
        variant: result.verified ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Validation process failed",
        variant: "destructive",
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
        setSelectedFile(file);
        setUploadStatus('idle');
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            setFileData(data);
            toast({
              title: "✅ File Selected",
              description: `${file.name} loaded successfully. Ready to upload or validate.`,
            });
          } catch (error) {
            setSelectedFile(null);
            setFileData(null);
            toast({
              title: "❌ Invalid File",
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

  const handleUpload = () => {
    if (!fileData) {
      toast({
        title: "⚠️ No File Selected",
        description: "Please select a JSON file before uploading",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(fileData);
  };

  const handleValidate = () => {
    if (!fileData) {
      toast({
        title: "⚠️ No File Selected",
        description: "Please select a JSON file before validating",
        variant: "destructive",
      });
      return;
    }
    
    // Use the first record from the file data for validation, or the whole data if it's a single object
    const dataToValidate = Array.isArray(fileData) ? fileData[0] : fileData;
    validateMutation.mutate(dataToValidate);
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
            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
              selectedFile 
                ? 'border-green-300 bg-green-50 dark:bg-green-900/10' 
                : uploadStatus === 'error'
                ? 'border-red-300 bg-red-50 dark:bg-red-900/10'
                : 'border-border'
            }`}>
              {selectedFile ? (
                <>
                  <i className="fas fa-file-check text-4xl text-green-600 mb-4"></i>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {(selectedFile.size / 1024).toFixed(2)} KB | Ready to process
                  </p>
                  <Button 
                    variant="outline"
                    onClick={handleFileSelect}
                    disabled={uploadMutation.isPending}
                    data-testid="button-change-file"
                  >
                    Change File
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
            
            {/* Upload Status Indicator */}
            {uploadStatus !== 'idle' && (
              <div className={`p-3 rounded-lg border ${
                uploadStatus === 'uploading' ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/10' :
                uploadStatus === 'success' ? 'border-green-200 bg-green-50 dark:bg-green-900/10' :
                'border-red-200 bg-red-50 dark:bg-red-900/10'
              }`}>
                <div className="flex items-center space-x-2">
                  <i className={`fas ${
                    uploadStatus === 'uploading' ? 'fa-spinner fa-spin text-blue-600' :
                    uploadStatus === 'success' ? 'fa-check-circle text-green-600' :
                    'fa-exclamation-circle text-red-600'
                  }`}></i>
                  <span className={`text-sm font-medium ${
                    uploadStatus === 'uploading' ? 'text-blue-800' :
                    uploadStatus === 'success' ? 'text-green-800' :
                    'text-red-800'
                  }`}>
                    {uploadStatus === 'uploading' ? 'Processing upload...' :
                     uploadStatus === 'success' ? 'Upload completed successfully' :
                     'Upload failed'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <Button 
                className="flex-1" 
                disabled={!fileData || uploadMutation.isPending}
                onClick={handleUpload}
                data-testid="button-upload-data"
              >
                {uploadMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Uploading...
                  </>
                ) : (
                  <>
                    <i className="fas fa-upload mr-2"></i>
                    Upload Data
                  </>
                )}
              </Button>
              <Button 
                variant="secondary"
                onClick={handleValidate}
                disabled={!fileData || validateMutation.isPending}
                data-testid="button-validate-data"
              >
                {validateMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Validating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-shield-alt mr-2"></i>
                    Validate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
