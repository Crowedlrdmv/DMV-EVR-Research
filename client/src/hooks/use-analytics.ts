import { useQuery } from "@tanstack/react-query";

export function useAnalytics() {
  const summary = useQuery({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 60000, // Refresh every minute
  });

  const trends = useQuery({
    queryKey: ["/api/analytics/trends"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const health = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return {
    summary,
    trends,
    health,
    isLoading: summary.isLoading || trends.isLoading,
    error: summary.error || trends.error || health.error,
  };
}

export function useVerificationStatus() {
  return useQuery({
    queryKey: ["/api/ingestion/status"],
    retry: false, // Don't retry on auth errors
    refetchInterval: 60000,
  });
}

export function useRecentVerifications() {
  return useQuery({
    queryKey: ["/api/verifications/recent"],
    refetchInterval: 30000,
  });
}
