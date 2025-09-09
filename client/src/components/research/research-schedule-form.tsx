import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const US_STATES = [
  'CA', 'NY', 'TX', 'FL', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI',
  'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI',
  'CO', 'MN', 'SC', 'AL', 'LA', 'KY', 'OR', 'OK', 'CT', 'UT',
  'IA', 'NV', 'AR', 'MS', 'KS', 'NM', 'NE', 'WV', 'ID', 'HI',
  'NH', 'ME', 'MT', 'RI', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY'
];

const DATA_TYPES = [
  { value: 'rules', label: 'Rules & Regulations' },
  { value: 'emissions', label: 'Emissions Requirements' },
  { value: 'inspections', label: 'Inspection Programs' },
  { value: 'bulletins', label: 'Official Bulletins' },
  { value: 'forms', label: 'Required Forms' },
];

const COMMON_SCHEDULES = [
  { value: '0 9 * * *', label: 'Daily at 9:00 AM' },
  { value: '0 9 * * 1', label: 'Weekly on Monday at 9:00 AM' },
  { value: '0 9 1 * *', label: 'Monthly on the 1st at 9:00 AM' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9:00 AM' },
  { value: '0 */4 * * *', label: 'Every 4 hours' },
  { value: 'custom', label: 'Custom Schedule' },
];

const formSchema = z.object({
  name: z.string().min(1, "Schedule name is required"),
  states: z.array(z.string()).min(1, "At least one state is required"),
  dataTypes: z.array(z.string()).min(1, "At least one data type is required"),
  depth: z.enum(['summary', 'full']),
  cronExpression: z.string().min(1, "Schedule is required"),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface ResearchScheduleFormProps {
  initialData?: any;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ResearchScheduleForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isSubmitting = false 
}: ResearchScheduleFormProps) {
  const [selectedStates, setSelectedStates] = useState<string[]>(initialData?.states || []);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>(initialData?.dataTypes || []);
  const [scheduleType, setScheduleType] = useState<string>('0 9 * * *');
  const [showCustomCron, setShowCustomCron] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      states: initialData?.states || [],
      dataTypes: initialData?.dataTypes || [],
      depth: initialData?.depth || 'summary',
      cronExpression: initialData?.cronExpression || '0 9 * * *',
      isActive: initialData?.isActive ?? true,
    },
  });

  useEffect(() => {
    if (initialData?.cronExpression) {
      const matchingSchedule = COMMON_SCHEDULES.find(s => s.value === initialData.cronExpression);
      if (matchingSchedule) {
        setScheduleType(matchingSchedule.value);
        setShowCustomCron(false);
      } else {
        setScheduleType('custom');
        setShowCustomCron(true);
      }
    }
  }, [initialData]);

  const handleSubmit = (data: FormData) => {
    onSubmit({
      ...data,
      states: selectedStates,
      dataTypes: selectedDataTypes,
    });
  };

  const handleStateToggle = (state: string) => {
    const updated = selectedStates.includes(state)
      ? selectedStates.filter(s => s !== state)
      : [...selectedStates, state];
    setSelectedStates(updated);
    form.setValue('states', updated);
  };

  const handleDataTypeToggle = (dataType: string) => {
    const updated = selectedDataTypes.includes(dataType)
      ? selectedDataTypes.filter(dt => dt !== dataType)
      : [...selectedDataTypes, dataType];
    setSelectedDataTypes(updated);
    form.setValue('dataTypes', updated);
  };

  const handleScheduleChange = (value: string) => {
    setScheduleType(value);
    if (value === 'custom') {
      setShowCustomCron(true);
    } else {
      setShowCustomCron(false);
      form.setValue('cronExpression', value);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Schedule Name</Label>
          <Input
            id="name"
            placeholder="e.g., Weekly CA Emissions Check"
            {...form.register('name')}
            data-testid="input-schedule-name"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label>Research Depth</Label>
          <Select 
            value={form.watch('depth')} 
            onValueChange={(value: 'summary' | 'full') => form.setValue('depth', value)}
          >
            <SelectTrigger data-testid="select-research-depth">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary - Quick overview</SelectItem>
              <SelectItem value="full">Full - Complete analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* States Selection */}
      <div>
        <Label>States to Monitor</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Select the states you want to include in this scheduled research
        </p>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-40 overflow-y-auto border rounded p-3">
          {US_STATES.map((state) => (
            <div key={state} className="flex items-center space-x-1">
              <Checkbox
                id={`state-${state}`}
                checked={selectedStates.includes(state)}
                onCheckedChange={() => handleStateToggle(state)}
                data-testid={`checkbox-state-${state}`}
              />
              <Label htmlFor={`state-${state}`} className="text-xs font-mono">
                {state}
              </Label>
            </div>
          ))}
        </div>
        {selectedStates.length > 0 && (
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">Selected states:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedStates.map((state) => (
                <Badge key={state} variant="secondary" className="text-xs">
                  {state}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {form.formState.errors.states && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.states.message}</p>
        )}
      </div>

      {/* Data Types Selection */}
      <div>
        <Label>Data Types to Research</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Choose what types of compliance information to research
        </p>
        <div className="space-y-2">
          {DATA_TYPES.map((dataType) => (
            <div key={dataType.value} className="flex items-center space-x-2">
              <Checkbox
                id={`datatype-${dataType.value}`}
                checked={selectedDataTypes.includes(dataType.value)}
                onCheckedChange={() => handleDataTypeToggle(dataType.value)}
                data-testid={`checkbox-datatype-${dataType.value}`}
              />
              <Label htmlFor={`datatype-${dataType.value}`}>
                {dataType.label}
              </Label>
            </div>
          ))}
        </div>
        {selectedDataTypes.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1">
              {selectedDataTypes.map((dataType) => (
                <Badge key={dataType} variant="outline" className="text-xs">
                  {DATA_TYPES.find(dt => dt.value === dataType)?.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {form.formState.errors.dataTypes && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.dataTypes.message}</p>
        )}
      </div>

      {/* Schedule Configuration */}
      <div>
        <Label>Schedule</Label>
        <p className="text-sm text-muted-foreground mb-3">
          When should this research job run automatically?
        </p>
        <div className="space-y-3">
          <Select value={scheduleType} onValueChange={handleScheduleChange}>
            <SelectTrigger data-testid="select-schedule-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_SCHEDULES.map((schedule) => (
                <SelectItem key={schedule.value} value={schedule.value}>
                  {schedule.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showCustomCron && (
            <div>
              <Label htmlFor="cronExpression">Custom Cron Expression</Label>
              <Input
                id="cronExpression"
                placeholder="0 9 * * *"
                {...form.register('cronExpression')}
                data-testid="input-cron-expression"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: minute hour day month weekday (e.g., "0 9 * * *" = daily at 9am)
              </p>
            </div>
          )}
        </div>
        {form.formState.errors.cronExpression && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.cronExpression.message}</p>
        )}
      </div>

      {/* Active Status */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isActive"
          checked={form.watch('isActive')}
          onCheckedChange={(checked) => form.setValue('isActive', !!checked)}
          data-testid="checkbox-is-active"
        />
        <Label htmlFor="isActive">
          Start this schedule immediately after creation
        </Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="button-cancel-schedule"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          data-testid="button-submit-schedule"
        >
          {isSubmitting ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              {initialData ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <i className="fas fa-save mr-2"></i>
              {initialData ? 'Update Schedule' : 'Create Schedule'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}