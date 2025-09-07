import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

export default function MetricsGrid() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/analytics/summary"],
  });

  const metrics = [
    {
      title: "Total Records",
      value: (summary as any)?.metrics?.totalRecords || 0,
      icon: "fas fa-database",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      change: "+0%",
      changeColor: "text-green-600",
      testId: "metric-total-records"
    },
    {
      title: "Compliance Rate", 
      value: (summary as any)?.metrics?.complianceRate || "100%",
      icon: "fas fa-check-circle",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      change: "+0%",
      changeColor: "text-green-600",
      testId: "metric-compliance-rate"
    },
    {
      title: "Failed Verifications",
      value: (summary as any)?.metrics?.failedVerifications || 0,
      icon: "fas fa-exclamation-triangle", 
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      change: "+0%",
      changeColor: "text-red-600",
      testId: "metric-failed-verifications"
    },
    {
      title: "API Calls Today",
      value: (summary as any)?.metrics?.apiCalls || 0,
      icon: "fas fa-exchange-alt",
      iconBg: "bg-blue-100", 
      iconColor: "text-blue-600",
      change: "+0%",
      changeColor: "text-blue-600",
      testId: "metric-api-calls"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric) => (
        <Card key={metric.title} className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                <p 
                  className="text-2xl font-bold text-foreground" 
                  data-testid={metric.testId}
                >
                  {metric.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${metric.iconBg} rounded-lg flex items-center justify-center`}>
                <i className={`${metric.icon} ${metric.iconColor}`}></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={`${metric.changeColor} font-medium`}>{metric.change}</span>
              <span className="text-muted-foreground ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
