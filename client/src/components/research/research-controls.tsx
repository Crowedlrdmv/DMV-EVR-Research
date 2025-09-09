import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { researchApi, asArray, type ResearchDepth } from "@/lib/researchApi";
import { queryClient } from "@/lib/queryClient";

interface ResearchControlsProps {
  selectedStates: string[];
  setSelectedStates: (states: string[]) => void;
  selectedDataTypes: Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>;
  setSelectedDataTypes: (types: Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>) => void;
  depth: ResearchDepth;
  setDepth: (depth: ResearchDepth) => void;
}

// Available states (US postal codes)
const AVAILABLE_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const DATA_TYPES = [
  { value: 'rules' as const, label: 'Rules & Regulations' },
  { value: 'emissions' as const, label: 'Emissions Requirements' },
  { value: 'inspections' as const, label: 'Vehicle Inspections' },
  { value: 'bulletins' as const, label: 'Technical Bulletins' },
  { value: 'forms' as const, label: 'Required Forms' }
];

export default function ResearchControls({
  selectedStates,
  setSelectedStates,
  selectedDataTypes,
  setSelectedDataTypes,
  depth,
  setDepth
}: ResearchControlsProps) {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    states: [] as string[],
    dataTypes: [] as Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>,
    depth: 'summary' as 'summary' | 'full',
    cronExpression: '0 9 * * 1', // Default: Monday at 9 AM
    cronPreset: 'weekly'
  });
  const { toast } = useToast();

  // Check for running jobs to prevent duplicates
  const { data: jobs } = useQuery({
    queryKey: ['/api/research/jobs'],
    queryFn: researchApi.getJobs,
    refetchInterval: 3000, // Poll every 3 seconds while jobs are running
  });

  // Run research mutation
  const runResearchMutation = useMutation({
    mutationFn: researchApi.runResearch,
    onSuccess: (result) => {
      toast({
        title: "✅ Research Started",
        description: result.message,
      });
      // Invalidate jobs query to refresh the table
      queryClient.invalidateQueries({ queryKey: ['/api/research/jobs'] });
    },
    onError: (error) => {
      const isDisabled = error.message.includes('disabled in this environment');
      toast({
        title: isDisabled ? "ℹ️ Research Disabled" : "❌ Research Failed",
        description: isDisabled 
          ? "Research runs are disabled in preview mode. You can still view existing jobs and results."
          : error instanceof Error ? error.message : "Failed to start research job",
        variant: isDisabled ? "default" : "destructive",
      });
    },
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: researchApi.createSchedule,
    onSuccess: (result) => {
      if (result) {
        toast({
          title: "✅ Schedule Created",
          description: `Schedule "${result.name}" created successfully`,
        });
        setShowScheduleDialog(false);
        setScheduleForm({
          name: '',
          states: [],
          dataTypes: [],
          depth: 'summary',
          cronExpression: '0 9 * * 1',
          cronPreset: 'weekly'
        });
      }
    },
  });

  // Cron preset options
  const cronPresets = [
    { value: 'daily', label: 'Daily at 9:00 AM', cron: '0 9 * * *' },
    { value: 'weekly', label: 'Weekly on Monday at 9:00 AM', cron: '0 9 * * 1' },
    { value: 'monthly', label: 'Monthly on the 1st at 9:00 AM', cron: '0 9 1 * *' },
    { value: 'weekdays', label: 'Weekdays at 9:00 AM', cron: '0 9 * * 1-5' },
    { value: 'custom', label: 'Custom', cron: '' }
  ];

  const handleStateChange = (state: string, checked: boolean) => {
    if (checked) {
      setSelectedStates([...selectedStates, state]);
    } else {
      setSelectedStates(selectedStates.filter(s => s !== state));
    }
  };

  const handleDataTypeChange = (dataType: 'rules'|'emissions'|'inspections'|'bulletins'|'forms', checked: boolean) => {
    if (checked) {
      setSelectedDataTypes([...selectedDataTypes, dataType]);
    } else {
      setSelectedDataTypes(selectedDataTypes.filter(t => t !== dataType));
    }
  };

  // Schedule form handlers
  const handleScheduleStateChange = (state: string, checked: boolean) => {
    if (checked) {
      setScheduleForm(prev => ({ ...prev, states: [...prev.states, state] }));
    } else {
      setScheduleForm(prev => ({ ...prev, states: prev.states.filter(s => s !== state) }));
    }
  };

  const handleScheduleDataTypeChange = (dataType: 'rules'|'emissions'|'inspections'|'bulletins'|'forms', checked: boolean) => {
    if (checked) {
      setScheduleForm(prev => ({ ...prev, dataTypes: [...prev.dataTypes, dataType] }));
    } else {
      setScheduleForm(prev => ({ ...prev, dataTypes: prev.dataTypes.filter(t => t !== dataType) }));
    }
  };

  const handleCronPresetChange = (preset: string) => {
    const cronOption = cronPresets.find(p => p.value === preset);
    setScheduleForm(prev => ({
      ...prev,
      cronPreset: preset,
      cronExpression: cronOption?.cron || prev.cronExpression
    }));
  };

  const handleCreateSchedule = () => {
    if (!scheduleForm.name.trim()) {
      toast({
        title: "❌ Validation Error",
        description: "Please enter a schedule name",
        variant: "destructive",
      });
      return;
    }

    if (scheduleForm.states.length === 0) {
      toast({
        title: "❌ Validation Error",
        description: "Please select at least one state",
        variant: "destructive",
      });
      return;
    }

    if (scheduleForm.dataTypes.length === 0) {
      toast({
        title: "❌ Validation Error",
        description: "Please select at least one data type",
        variant: "destructive",
      });
      return;
    }

    if (!scheduleForm.cronExpression.trim()) {
      toast({
        title: "❌ Validation Error",
        description: "Please enter a valid cron expression",
        variant: "destructive",
      });
      return;
    }

    createScheduleMutation.mutate({
      name: scheduleForm.name.trim(),
      states: scheduleForm.states,
      dataTypes: scheduleForm.dataTypes,
      depth: scheduleForm.depth,
      cronExpression: scheduleForm.cronExpression
    });
  };

  const prefillFromCurrentSelection = () => {
    setScheduleForm(prev => ({
      ...prev,
      states: selectedStates,
      dataTypes: selectedDataTypes,
      depth: depth
    }));
  };

  const handleRunResearch = () => {
    if (selectedStates.length === 0) {
      toast({
        title: "❌ Validation Error",
        description: "Please select at least one state",
        variant: "destructive",
      });
      return;
    }

    if (selectedDataTypes.length === 0) {
      toast({
        title: "❌ Validation Error", 
        description: "Please select at least one data type",
        variant: "destructive",
      });
      return;
    }

    runResearchMutation.mutate({
      states: selectedStates,
      dataTypes: selectedDataTypes,
      depth
    });
  };

  // Check if duplicate job is running (with safe array guards)
  const safeJobs = asArray(jobs, 'jobs');
  const isDuplicateRunning = safeJobs.some((job: any) => 
    (job.status === 'queued' || job.status === 'running') &&
    (Array.isArray(job.states) ? job.states.slice().sort().join(',') : '') === selectedStates.slice().sort().join(',') &&
    (Array.isArray(job.dataTypes) ? job.dataTypes.slice().sort().join(',') : '') === selectedDataTypes.slice().sort().join(',')
  ) || false;

  const isRunDisabled = runResearchMutation.isPending || 
                       isDuplicateRunning ||
                       selectedStates.length === 0 ||
                       selectedDataTypes.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <i className="fas fa-cogs text-lg"></i>
          Research Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* States Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Select States</Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_STATES.map(state => (
                  <div key={state} className="flex items-center space-x-2">
                    <Checkbox
                      id={`state-${state}`}
                      checked={selectedStates.includes(state)}
                      onCheckedChange={(checked) => handleStateChange(state, checked as boolean)}
                      data-testid={`checkbox-state-${state}`}
                    />
                    <Label 
                      htmlFor={`state-${state}`} 
                      className="text-sm font-mono cursor-pointer"
                    >
                      {state}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Selected: {selectedStates.length} states
            </div>
          </div>

          {/* Data Types Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Data Types</Label>
            <div className="space-y-3">
              {DATA_TYPES.map(dataType => (
                <div key={dataType.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`datatype-${dataType.value}`}
                    checked={selectedDataTypes.includes(dataType.value)}
                    onCheckedChange={(checked) => handleDataTypeChange(dataType.value, checked as boolean)}
                    data-testid={`checkbox-datatype-${dataType.value}`}
                  />
                  <Label 
                    htmlFor={`datatype-${dataType.value}`} 
                    className="text-sm cursor-pointer"
                  >
                    {dataType.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Depth Selection & Actions */}
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Research Depth</Label>
              <RadioGroup 
                value={depth} 
                onValueChange={(value) => setDepth(value as ResearchDepth)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="summary" id="depth-summary" data-testid="radio-depth-summary" />
                  <Label htmlFor="depth-summary" className="cursor-pointer">
                    Summary
                    <div className="text-xs text-muted-foreground">Quick overview of key requirements</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="depth-full" data-testid="radio-depth-full" />
                  <Label htmlFor="depth-full" className="cursor-pointer">
                    Full Details
                    <div className="text-xs text-muted-foreground">Comprehensive analysis with citations</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleRunResearch}
                disabled={isRunDisabled}
                className="w-full"
                data-testid="button-run-research"
                title={isDuplicateRunning ? 'A similar research job is already running' : undefined}
              >
                {runResearchMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Starting Research...
                  </>
                ) : isDuplicateRunning ? (
                  <>
                    <i className="fas fa-clock mr-2"></i>
                    Similar Job Running
                  </>
                ) : (
                  <>
                    <i className="fas fa-play mr-2"></i>
                    Run Research
                  </>
                )}
              </Button>

              <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled={!researchApi.isScheduleEnabled()}
                    data-testid="button-schedule-research"
                  >
                    <i className="fas fa-calendar-alt mr-2"></i>
                    Schedule Research
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {researchApi.isScheduleEnabled() ? 'Schedule Automated Research' : 'Scheduling Not Available'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {researchApi.isScheduleEnabled() ? (
                      <div className="space-y-6">
                        {/* Quick fill from current selection */}
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="text-sm">
                            <p className="font-medium mb-1">Use current selection</p>
                            <p className="text-muted-foreground">
                              Fill form with your current research configuration
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={prefillFromCurrentSelection}
                            disabled={selectedStates.length === 0 || selectedDataTypes.length === 0}
                          >
                            <i className="fas fa-copy mr-1"></i>
                            Copy
                          </Button>
                        </div>

                        {/* Schedule name */}
                        <div className="space-y-2">
                          <Label htmlFor="schedule-name">Schedule Name</Label>
                          <Input
                            id="schedule-name"
                            placeholder="e.g., Weekly CA & TX Rules Check"
                            value={scheduleForm.name}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* States selection for schedule */}
                          <div className="space-y-3">
                            <Label>Select States</Label>
                            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                              <div className="grid grid-cols-3 gap-2">
                                {AVAILABLE_STATES.map(state => (
                                  <div key={state} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`schedule-state-${state}`}
                                      checked={scheduleForm.states.includes(state)}
                                      onCheckedChange={(checked) => handleScheduleStateChange(state, checked as boolean)}
                                    />
                                    <Label 
                                      htmlFor={`schedule-state-${state}`} 
                                      className="text-sm font-mono cursor-pointer"
                                    >
                                      {state}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Selected: {scheduleForm.states.length} states
                            </div>
                          </div>

                          {/* Data types for schedule */}
                          <div className="space-y-3">
                            <Label>Data Types</Label>
                            <div className="space-y-3">
                              {DATA_TYPES.map(dataType => (
                                <div key={dataType.value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`schedule-datatype-${dataType.value}`}
                                    checked={scheduleForm.dataTypes.includes(dataType.value)}
                                    onCheckedChange={(checked) => handleScheduleDataTypeChange(dataType.value, checked as boolean)}
                                  />
                                  <Label 
                                    htmlFor={`schedule-datatype-${dataType.value}`} 
                                    className="text-sm cursor-pointer"
                                  >
                                    {dataType.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Research depth for schedule */}
                          <div className="space-y-3">
                            <Label>Research Depth</Label>
                            <RadioGroup 
                              value={scheduleForm.depth} 
                              onValueChange={(value) => setScheduleForm(prev => ({ ...prev, depth: value as 'summary' | 'full' }))}
                              className="space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="summary" id="schedule-depth-summary" />
                                <Label htmlFor="schedule-depth-summary" className="cursor-pointer">
                                  Summary
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="full" id="schedule-depth-full" />
                                <Label htmlFor="schedule-depth-full" className="cursor-pointer">
                                  Full Details
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Schedule timing */}
                          <div className="space-y-3">
                            <Label>Schedule</Label>
                            <div className="space-y-3">
                              <Select value={scheduleForm.cronPreset} onValueChange={handleCronPresetChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select schedule" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cronPresets.map(preset => (
                                    <SelectItem key={preset.value} value={preset.value}>
                                      {preset.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {scheduleForm.cronPreset === 'custom' && (
                                <div className="space-y-2">
                                  <Label htmlFor="cron-expression">Cron Expression</Label>
                                  <Input
                                    id="cron-expression"
                                    placeholder="0 9 * * 1"
                                    value={scheduleForm.cronExpression}
                                    onChange={(e) => setScheduleForm(prev => ({ ...prev, cronExpression: e.target.value }))}
                                  />
                                  <div className="text-xs text-muted-foreground">
                                    Format: minute hour day month weekday
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Schedule summary */}
                        <div className="p-3 bg-muted rounded-lg text-sm">
                          <div className="font-medium mb-2">Schedule Summary:</div>
                          <div className="space-y-1 text-muted-foreground">
                            <div>Name: {scheduleForm.name || 'Unnamed schedule'}</div>
                            <div>States: {scheduleForm.states.join(', ') || 'None selected'}</div>
                            <div>Types: {scheduleForm.dataTypes.join(', ') || 'None selected'}</div>
                            <div>Depth: {scheduleForm.depth}</div>
                            <div>
                              Schedule: {cronPresets.find(p => p.value === scheduleForm.cronPreset)?.label || 'Custom'} 
                              {scheduleForm.cronExpression && ` (${scheduleForm.cronExpression})`}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                          <Button 
                            onClick={handleCreateSchedule} 
                            disabled={createScheduleMutation.isPending}
                            className="flex-1"
                          >
                            {createScheduleMutation.isPending ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Creating...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-calendar-plus mr-2"></i>
                                Create Schedule
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowScheduleDialog(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-muted-foreground">
                          Scheduling is not available in this environment. This feature allows you to set up recurring research jobs that run automatically at specified intervals.
                        </p>
                        <div className="p-3 bg-muted rounded-lg text-sm">
                          <p className="font-medium mb-1">To enable scheduling:</p>
                          <p className="text-muted-foreground">
                            Set <code>VITE_RESEARCH_SCHEDULE_ENABLED=true</code> in your environment configuration.
                          </p>
                        </div>
                        <Button onClick={() => setShowScheduleDialog(false)} className="w-full">
                          Got it
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Selected Configuration Summary */}
            {(selectedStates.length > 0 || selectedDataTypes.length > 0) && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="font-medium mb-2">Current Selection:</div>
                <div className="space-y-1">
                  <div>States: {selectedStates.join(', ') || 'None'}</div>
                  <div>Types: {selectedDataTypes.join(', ') || 'None'}</div>
                  <div>Depth: {depth}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}