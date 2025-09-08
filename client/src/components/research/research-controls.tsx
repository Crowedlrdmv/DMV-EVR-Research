import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { researchApi, type ResearchDepth } from "@/lib/researchApi";
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
  const safeJobs = Array.isArray(jobs) ? jobs : Array.isArray((jobs as any)?.jobs) ? (jobs as any).jobs : [];
  const isDuplicateRunning = safeJobs.some(job => 
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
                  <Button variant="outline" className="w-full" data-testid="button-schedule-research">
                    <i className="fas fa-calendar-alt mr-2"></i>
                    Schedule Research
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Automated Research</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Scheduled research functionality would be implemented here.
                      This would allow users to set up recurring research jobs.
                    </p>
                    <Button onClick={() => setShowScheduleDialog(false)} className="w-full">
                      Close
                    </Button>
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