import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { researchApi } from "@/lib/researchApi";

export default function ResearchSummaryCards() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['/api/research/summary'],
    queryFn: researchApi.getSummary,
    staleTime: 30000, // Cache for 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Loading...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Programs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <i className="fas fa-file-alt text-blue-500"></i>
            Programs Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-total-programs">
            {summary?.totalPrograms?.toLocaleString() || "0"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Compliance programs discovered
          </p>
        </CardContent>
      </Card>

      {/* States Covered */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <i className="fas fa-map-marked-alt text-green-500"></i>
            States Covered
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600" data-testid="metric-states-covered">
            {summary?.statesCovered || "0"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Unique states researched
          </p>
        </CardContent>
      </Card>

      {/* Research Artifacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <i className="fas fa-archive text-purple-500"></i>
            Artifacts Collected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600" data-testid="metric-total-artifacts">
            {summary?.totalArtifacts?.toLocaleString() || "0"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Documents & sources saved
          </p>
        </CardContent>
      </Card>
    </div>
  );
}