import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { researchApi, formatJobDuration, getStatusColor, type ResearchJob } from "@/lib/researchApi";
import { toast } from "@/hooks/use-toast";

interface ResearchJobsTableProps {
  onJobSelect?: (jobId: string) => void;
}

export default function ResearchJobsTable({ onJobSelect }: ResearchJobsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Query jobs with conditional polling
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['/api/research/jobs'],
    queryFn: researchApi.getJobs,
    refetchInterval: (query) => {
      // Poll every 3 seconds if any job is queued or running
      const data = query.state.data;
      const safeData = Array.isArray(data) ? data : [];
      const hasActiveJobs = safeData.some((job: ResearchJob) => 
        job.status === 'queued' || job.status === 'running'
      );
      return hasActiveJobs ? 3000 : false;
    },
  });

  // Retry job mutation
  const retryJobMutation = useMutation({
    mutationFn: async (job: ResearchJob) => {
      return researchApi.runResearch({
        states: job.states,
        dataTypes: job.dataTypes as Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>,
        depth: job.depth
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research/jobs'] });
      toast({
        title: "Job Retried",
        description: "Research job has been restarted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Retry Failed",
        description: "Failed to retry the research job. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Get only last 25 jobs with safe array handling
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const displayJobs = safeJobs.slice(0, 25);

  const toggleRowExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedRows(newExpanded);
  };

  const handleRetryJob = (job: ResearchJob) => {
    retryJobMutation.mutate(job);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading jobs...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayJobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <i className="fas fa-tasks text-4xl text-muted-foreground mb-4"></i>
            <h3 className="text-lg font-medium text-foreground mb-2">No Research Jobs</h3>
            <p className="text-muted-foreground mb-4">
              Start your first research job using the controls above
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-4"></TableHead>
                <TableHead>Started</TableHead>
                <TableHead>State(s)</TableHead>
                <TableHead>Data Types</TableHead>
                <TableHead>Depth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Artifacts</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayJobs.map((job) => (
                <Collapsible key={job.id} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        data-testid={`job-row-${job.id}`}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleRowExpansion(job.id)}
                          >
                            <i className={`fas fa-chevron-${expandedRows.has(job.id) ? 'down' : 'right'} text-xs`}></i>
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTimestamp(job.startedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(job.states) && job.states.length > 0 ? (
                              job.states.map(state => (
                                <Badge key={state} variant="outline" className="text-xs">
                                  {state}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">No states</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(job.dataTypes) && job.dataTypes.length > 0 ? (
                              job.dataTypes.map(type => (
                                <Badge key={type} variant="secondary" className="text-xs">
                                  {type}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">No types</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.depth === 'full' ? 'default' : 'outline'} className="text-xs">
                            {job.depth}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge 
                              className={`text-xs ${getStatusColor(job.status)}`}
                              data-testid={`job-status-${job.status}`}
                            >
                              {job.status === 'running' && <i className="fas fa-spinner fa-spin mr-1"></i>}
                              {job.status}
                            </Badge>
                            {job.status === 'running' && job.progress !== undefined && (
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.max(job.progress, 5)}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatJobDuration(job.startedAt, job.finishedAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {job.stats?.artifacts ?? 0}
                        </TableCell>
                        <TableCell>
                          {job.errorText ? (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30">
                          <div className="p-4 space-y-4">
                            {/* Job Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Job Details</h4>
                                <div className="space-y-1 text-sm">
                                  <div>Job ID: <code className="text-xs bg-muted px-1 rounded">{job.id}</code></div>
                                  <div>Started: {formatTimestamp(job.startedAt)}</div>
                                  {job.finishedAt && (
                                    <div>Finished: {formatTimestamp(job.finishedAt)}</div>
                                  )}
                                  <div>Programs Found: {job.stats?.programs || 0}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Configuration</h4>
                                <div className="space-y-1 text-sm">
                                  <div>States: {Array.isArray(job.states) ? job.states.join(', ') : 'None'}</div>
                                  <div>Data Types: {Array.isArray(job.dataTypes) ? job.dataTypes.join(', ') : 'None'}</div>
                                  <div>Research Depth: {job.depth}</div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            {job.status === 'success' && (job.stats?.programs || 0) > 0 && onJobSelect && (
                              <div className="flex items-center justify-between pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                  Found {job.stats?.programs || 0} programs in this job
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => onJobSelect(job.id)}
                                  data-testid={`button-view-results-${job.id}`}
                                >
                                  <i className="fas fa-eye mr-2"></i>
                                  View Results
                                </Button>
                              </div>
                            )}

                            {/* Error Text and Retry */}
                            {job.errorText && (
                              <div>
                                <h4 className="font-medium mb-2 text-red-600">Error Details</h4>
                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm mb-3">
                                  {job.errorText}
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleRetryJob(job)}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  data-testid={`button-retry-${job.id}`}
                                >
                                  <i className="fas fa-redo mr-2"></i>
                                  Retry Job
                                </Button>
                              </div>
                            )}

                            {/* Recent Logs */}
                            {Array.isArray(job.logs) && job.logs.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2">Recent Logs (Last 30 lines)</h4>
                                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs max-h-64 overflow-y-auto">
                                  {job.logs.slice(-30).map((log, index) => (
                                    <div key={index}>{log}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* State-specific subtasks would be shown here */}
                            <div>
                              <h4 className="font-medium mb-2">State Progress</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {Array.isArray(job.states) && job.states.length > 0 ? (
                                  job.states.map(state => (
                                    <div key={state} className="flex items-center justify-between p-2 bg-background rounded border">
                                      <span className="font-mono text-sm">{state}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {job.status === 'success' ? 'Complete' : 'Pending'}
                                      </Badge>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-muted-foreground text-sm">No states configured</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}