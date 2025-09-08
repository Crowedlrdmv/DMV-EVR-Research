import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { researchApi, formatJobDuration, getStatusColor, type ResearchJob } from "@/lib/researchApi";

export default function ResearchJobsTable() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Query jobs with conditional polling
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['/api/research/jobs'],
    queryFn: researchApi.getJobs,
    refetchInterval: (query) => {
      // Poll every 3 seconds if any job is queued or running
      const data = query.state.data;
      const hasActiveJobs = data?.some((job: ResearchJob) => 
        job.status === 'queued' || job.status === 'running'
      );
      return hasActiveJobs ? 3000 : false;
    },
  });

  // Get only last 25 jobs
  const displayJobs = jobs?.slice(0, 25) || [];

  const toggleRowExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedRows(newExpanded);
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
                            {job.states.map(state => (
                              <Badge key={state} variant="outline" className="text-xs">
                                {state}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {job.dataTypes.map(type => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.depth === 'full' ? 'default' : 'outline'} className="text-xs">
                            {job.depth}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={`text-xs ${getStatusColor(job.status)}`}
                            data-testid={`job-status-${job.status}`}
                          >
                            {job.status === 'running' && <i className="fas fa-spinner fa-spin mr-1"></i>}
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatJobDuration(job.startedAt, job.finishedAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {job.stats?.artifacts || 0}
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
                                  <div>States: {job.states.join(', ')}</div>
                                  <div>Data Types: {job.dataTypes.join(', ')}</div>
                                  <div>Research Depth: {job.depth}</div>
                                </div>
                              </div>
                            </div>

                            {/* Error Text */}
                            {job.errorText && (
                              <div>
                                <h4 className="font-medium mb-2 text-red-600">Error Details</h4>
                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                                  {job.errorText}
                                </div>
                              </div>
                            )}

                            {/* Recent Logs */}
                            {job.logs && job.logs.length > 0 && (
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
                                {job.states.map(state => (
                                  <div key={state} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <span className="font-mono text-sm">{state}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {job.status === 'success' ? 'Complete' : 'Pending'}
                                    </Badge>
                                  </div>
                                ))}
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