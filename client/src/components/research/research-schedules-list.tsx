import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ResearchSchedule {
  id: string;
  name: string;
  states: string[];
  dataTypes: string[];
  depth: 'summary' | 'full';
  cronExpression: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ResearchSchedulesListProps {
  schedules: ResearchSchedule[];
  onEdit: (schedule: ResearchSchedule) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

// Helper function to describe cron expressions
function describeCron(cronExpression: string): string {
  const patterns: Record<string, string> = {
    '0 9 * * *': 'Daily at 9:00 AM',
    '0 9 * * 1': 'Weekly on Monday at 9:00 AM',
    '0 9 1 * *': 'Monthly on the 1st at 9:00 AM',
    '0 */4 * * *': 'Every 4 hours',
    '0 9 * * 1-5': 'Weekdays at 9:00 AM',
  };
  
  return patterns[cronExpression] || `Custom: ${cronExpression}`;
}

export function ResearchSchedulesList({ 
  schedules, 
  onEdit, 
  onDelete, 
  isDeleting = false 
}: ResearchSchedulesListProps) {
  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <i className="fas fa-calendar-alt text-4xl text-muted-foreground mb-4"></i>
            <h3 className="text-lg font-medium mb-2">No Schedules Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first research schedule to automate compliance monitoring
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Schedules ({schedules.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>States</TableHead>
                <TableHead>Data Types</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{schedule.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {schedule.depth === 'full' ? 'Full Analysis' : 'Summary'}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <div>{describeCron(schedule.cronExpression)}</div>
                      <code className="text-xs text-muted-foreground">
                        {schedule.cronExpression}
                      </code>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {schedule.states.slice(0, 3).map((state) => (
                        <Badge key={state} variant="outline" className="text-xs font-mono">
                          {state}
                        </Badge>
                      ))}
                      {schedule.states.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{schedule.states.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {schedule.states.length} state{schedule.states.length !== 1 ? 's' : ''}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      {schedule.dataTypes.map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs mr-1">
                          {type === 'rules' && 'Rules'}
                          {type === 'emissions' && 'Emissions'}
                          {type === 'inspections' && 'Inspections'}
                          {type === 'bulletins' && 'Bulletins'}
                          {type === 'forms' && 'Forms'}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      variant={schedule.isActive ? "default" : "secondary"}
                      className={schedule.isActive ? "bg-green-600" : ""}
                    >
                      {schedule.isActive ? (
                        <>
                          <i className="fas fa-play mr-1"></i>
                          Active
                        </>
                      ) : (
                        <>
                          <i className="fas fa-pause mr-1"></i>
                          Paused
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    {schedule.isActive ? (
                      <div className="text-sm">
                        <div>
                          {new Date(schedule.nextRunAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(schedule.nextRunAt).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {schedule.lastRunAt ? (
                      <div className="text-sm">
                        <div>
                          {new Date(schedule.lastRunAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(schedule.lastRunAt).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(schedule)}
                        data-testid={`button-edit-${schedule.id}`}
                      >
                        <i className="fas fa-edit mr-1"></i>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(schedule.id)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-delete-${schedule.id}`}
                      >
                        {isDeleting ? (
                          <i className="fas fa-spinner fa-spin mr-1"></i>
                        ) : (
                          <i className="fas fa-trash mr-1"></i>
                        )}
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}