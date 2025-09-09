import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VerificationResult {
  vehicleId: string;
  verified: boolean;
  details: string;
  timestamp: string;
}

export default function VerificationPanel() {
  const [testData, setTestData] = useState(`{
  "vehicle_id": "DMV_${Math.random().toString(36).substr(2, 6).toUpperCase()}",
  "compliance_status": "valid",
  "expiry_date": "${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}",
  "state": "CA",
  "inspection_type": "emissions"
}`);
  const [localVerifications, setLocalVerifications] = useState<VerificationResult[]>([]);
  
  // Load verification history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('verification-history');
      if (stored) {
        const parsedHistory = JSON.parse(stored);
        if (Array.isArray(parsedHistory)) {
          setLocalVerifications(parsedHistory.slice(0, 25)); // Keep last 25 entries
        }
      }
    } catch (error) {
      console.warn('Failed to load verification history:', error);
    }
  }, []);
  
  // Calculate success rate from stored verifications
  const calculateSuccessRate = (): string => {
    if (localVerifications.length === 0) return '—';
    
    const successCount = localVerifications.filter(v => v.verified).length;
    const percentage = (successCount / localVerifications.length) * 100;
    return `${percentage.toFixed(1)}%`;
  };
  
  // Save verification history to localStorage
  const saveVerificationHistory = (verifications: VerificationResult[]) => {
    try {
      localStorage.setItem('verification-history', JSON.stringify(verifications));
    } catch (error) {
      console.warn('Failed to save verification history:', error);
    }
  };
  
  const { toast } = useToast();

  const { data: recentRecords } = useQuery({
    queryKey: ["/api/verifications/recent"],
  });

  const { data: ingestionStatus } = useQuery({
    queryKey: ["/api/ingestion/status"],
    retry: false, // Don't retry on auth failures
    queryFn: async () => {
      const response = await fetch("/api/ingestion/status", {
        headers: {
          "Authorization": "Bearer sk-1234567890abcdef" // Default token for testing
        }
      });
      if (!response.ok) {
        if (response.status === 401) return null; // Return null for auth failures
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    }
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/verify", data);
      return response.json();
    },
    onSuccess: (result) => {
      // Store the verification result locally
      const newVerification: VerificationResult = {
        vehicleId: result.vehicleId,
        verified: result.verified,
        details: result.details || result.reason,
        timestamp: result.timestamp,
      };
      
      const updatedVerifications = [newVerification, ...localVerifications.slice(0, 24)]; // Keep last 25 results
      setLocalVerifications(updatedVerifications);
      saveVerificationHistory(updatedVerifications);

      toast({
        title: result.verified ? "✅ Verification Successful" : "❌ Verification Failed",
        description: result.details || result.reason,
        variant: result.verified ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleVerify = () => {
    try {
      const data = JSON.parse(testData);
      verifyMutation.mutate(data);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">AI Verification Service</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-muted-foreground">Service Online</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Verification Status */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Verification Status</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">Queue Length</span>
                <span className="font-medium text-foreground" data-testid="queue-length">
                  {(ingestionStatus as any)?.queueLength || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">Processing Time</span>
                <span className="font-medium text-foreground" data-testid="processing-time">
                  {(ingestionStatus as any)?.avgProcessingTime || "< 1s"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="font-medium text-green-600" data-testid="success-rate">
                  {calculateSuccessRate()}
                </span>
              </div>
            </div>
          </div>

          {/* Test Verification */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Test Verification</h4>
            <div className="space-y-3">
              <Textarea
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder="Enter test compliance data (JSON format)"
                className="h-24 resize-none"
                data-testid="textarea-test-data"
              />
              <Button 
                className="w-full"
                onClick={handleVerify}
                disabled={verifyMutation.isPending}
                data-testid="button-verify-data"
              >
                <i className="fas fa-shield-alt mr-2"></i>
                {verifyMutation.isPending ? "Verifying..." : "Verify Data"}
              </Button>
            </div>
          </div>

          {/* Recent Verifications */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Recent Verifications</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {localVerifications.length > 0 ? (
                localVerifications.map((verification, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col p-2 bg-muted rounded text-sm"
                    data-testid={`verification-item-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">
                        {verification.vehicleId}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        verification.verified 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      }`}>
                        {verification.verified ? '✅ Verified' : '❌ Failed'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {verification.details}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(verification.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">
                  <i className="fas fa-clipboard-check text-2xl mb-2 block"></i>
                  No recent verifications
                  <p className="text-xs mt-1">Verify some data to see results here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
