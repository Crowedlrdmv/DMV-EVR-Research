import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function VerificationPanel() {
  const [testData, setTestData] = useState(`{
  "vehicle_id": "ABC123",
  "compliance_status": "valid",
  "expiry_date": "2024-12-31"
}`);
  
  const { toast } = useToast();

  const { data: recentVerifications } = useQuery({
    queryKey: ["/api/verifications/recent"],
  });

  const { data: ingestionStatus } = useQuery({
    queryKey: ["/api/ingestion/status"],
    retry: false, // Don't retry on auth failures
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/verify", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Verification Complete",
        description: result.verified ? result.details : result.reason,
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
                  {(ingestionStatus as any)?.successRate || "100%"}
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
              {recentVerifications && (recentVerifications as any)?.length > 0 ? (
                (recentVerifications as any)?.map((verification: any, index: number) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                    data-testid={`verification-item-${index}`}
                  >
                    <span className="text-muted-foreground">{verification.vehicleId}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      verification.status === 'valid' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {verification.status === 'valid' ? 'Valid' : 'Expired'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No recent verifications
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
