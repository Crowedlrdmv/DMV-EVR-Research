import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, AlertTriangle, Sparkles, Database } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";

export default function AIVerification() {
  const [verificationData, setVerificationData] = useState('');
  const { toast } = useToast();

  // Fetch recent verification results
  const { data: recentVerifications, isLoading } = useQuery({
    queryKey: ['/api/verifications/recent'],
  });

  // Fetch verification analytics
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/analytics/summary'],
  });

  // Verification mutation
  const verifyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: result.verified ? "✅ Verification Passed" : "❌ Verification Failed",
        description: result.details || result.reason,
        variant: result.verified ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Error",
        description: error.message || "Failed to verify data",
        variant: "destructive",
      });
    }
  });

  const handleVerify = () => {
    if (!verificationData.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter compliance data to verify",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = JSON.parse(verificationData);
      verifyMutation.mutate(data);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data",
        variant: "destructive",
      });
    }
  };

  const handleQuickTest = () => {
    const testData = {
      compliance_type: "emissions",
      state: "CA",
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      test_result: "PASS",
      inspector_id: "INS-001"
    };
    setVerificationData(JSON.stringify(testData, null, 2));
  };

  const verificationStats = (analyticsData as any)?.metrics || {};
  const recentResults = (recentVerifications as any) || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-blue-600" />
              AI Verification
            </h1>
            <p className="text-gray-600 mt-2">
              Verify compliance records using AI-powered validation
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Records</p>
                    <p className="text-2xl font-bold">{verificationStats.totalRecords || 0}</p>
                  </div>
                  <Database className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Verified</p>
                    <p className="text-2xl font-bold text-green-600">{verificationStats.compliantRecords || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Non-Compliant</p>
                    <p className="text-2xl font-bold text-red-600">{verificationStats.nonCompliantRecords || 0}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">{verificationStats.complianceRate || '0%'}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Verification Input */}
            <Card>
              <CardHeader>
                <CardTitle>Verify Compliance Data</CardTitle>
                <CardDescription>
                  Enter compliance data in JSON format for AI verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-data">Compliance Data (JSON)</Label>
                  <Textarea
                    id="verification-data"
                    placeholder="Enter JSON compliance data..."
                    value={verificationData}
                    onChange={(e) => setVerificationData(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-compliance-data"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleVerify} 
                    disabled={verifyMutation.isPending}
                    className="flex-1"
                    data-testid="button-verify"
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Verify Data
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleQuickTest}
                    data-testid="button-quick-test"
                  >
                    Quick Test
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Verifications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Verifications</CardTitle>
                <CardDescription>
                  Latest verification results and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-400" />
                    <p className="text-gray-500">Loading verifications...</p>
                  </div>
                ) : (!recentResults || recentResults.length === 0) ? (
                  <div className="text-center py-8">
                    <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500">No recent verifications</p>
                    <p className="text-sm text-gray-400">Run a verification to see results here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(recentResults || []).slice(0, 10).map((verification: any, index: number) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        data-testid={`verification-result-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          {verification.verified ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium">
                              Verification Result
                            </p>
                            <p className="text-sm text-gray-600">
                              {verification.details || verification.reason}
                            </p>
                          </div>
                        </div>
                        <Badge variant={verification.verified ? "default" : "destructive"}>
                          {verification.verified ? "Valid" : "Invalid"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Verification Guidelines */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Verification Guidelines</CardTitle>
              <CardDescription>
                How AI verification works and data format requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="format" className="w-full">
                <TabsList>
                  <TabsTrigger value="format">Data Format</TabsTrigger>
                  <TabsTrigger value="rules">Validation Rules</TabsTrigger>
                  <TabsTrigger value="examples">Examples</TabsTrigger>
                </TabsList>
                <TabsContent value="format" className="space-y-3">
                  <p>The verification system accepts JSON data with the following structure:</p>
                  <div className="bg-gray-100 p-4 rounded-md font-mono text-sm">
                    {JSON.stringify({
                      compliance_type: "emissions | inspections | registration",
                      state: "string (state code)",
                      expiry_date: "ISO string date",
                      test_result: "PASS | FAIL",
                      inspector_id: "string (optional)"
                    }, null, 2)}
                  </div>
                </TabsContent>
                <TabsContent value="rules" className="space-y-3">
                  <ul className="list-disc list-inside space-y-2">
                    <li>Expiry dates must be in the future for verification to pass</li>
                    <li>All required fields must be present and valid</li>
                    <li>State codes must be valid US state abbreviations</li>
                    <li>Test results must be either "PASS" or "FAIL"</li>
                  </ul>
                </TabsContent>
                <TabsContent value="examples" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2 text-green-600">✅ Valid Example</h4>
                      <div className="bg-green-50 p-3 rounded-md font-mono text-sm">
                        {JSON.stringify({
                          compliance_type: "emissions",
                          state: "CA",
                          expiry_date: "2025-12-31T00:00:00Z",
                          test_result: "PASS"
                        }, null, 2)}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 text-red-600">❌ Invalid Example</h4>
                      <div className="bg-red-50 p-3 rounded-md font-mono text-sm">
                        {JSON.stringify({
                          compliance_type: "emissions",
                          state: "CA",
                          expiry_date: "2023-01-01T00:00:00Z", // Expired
                          test_result: "PASS"
                        }, null, 2)}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}