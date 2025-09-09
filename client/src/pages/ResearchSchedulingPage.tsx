import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResearchScheduleForm } from "@/components/research/research-schedule-form";
import { ResearchSchedulesList } from "@/components/research/research-schedules-list";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

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

export default function ResearchSchedulingPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ResearchSchedule | null>(null);
  const queryClient = useQueryClient();

  // Query schedules
  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ['/api/research/schedules'],
    queryFn: () => apiRequest('/api/research/schedules'),
  });

  const schedules = schedulesData?.schedules || [];

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/research/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research/schedules'] });
      setShowCreateForm(false);
      toast({
        title: "Schedule Created",
        description: "Research schedule has been created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Create Failed",
        description: error.message || "Failed to create schedule",
        variant: "destructive",
      });
    }
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/research/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research/schedules'] });
      setEditingSchedule(null);
      toast({
        title: "Schedule Updated",
        description: "Research schedule has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update schedule",
        variant: "destructive",
      });
    }
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/research/schedules/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research/schedules'] });
      toast({
        title: "Schedule Deleted",
        description: "Research schedule has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete schedule",
        variant: "destructive",
      });
    }
  });

  const handleCreateSchedule = (data: any) => {
    createScheduleMutation.mutate(data);
  };

  const handleUpdateSchedule = (data: any) => {
    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data });
    }
  };

  const handleDeleteSchedule = (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      deleteScheduleMutation.mutate(id);
    }
  };

  const handleEditSchedule = (schedule: ResearchSchedule) => {
    setEditingSchedule(schedule);
    setShowCreateForm(false);
  };

  const handleCancelEdit = () => {
    setEditingSchedule(null);
    setShowCreateForm(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Research Scheduling</h1>
        </div>
        <div className="text-center py-8">Loading schedules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Research Scheduling</h1>
          <p className="text-muted-foreground">
            Automate your research jobs with scheduled execution
          </p>
        </div>
        {!showCreateForm && !editingSchedule && (
          <Button onClick={() => setShowCreateForm(true)} data-testid="button-create-schedule">
            <i className="fas fa-plus mr-2"></i>
            Create Schedule
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {schedules.filter((s: ResearchSchedule) => s.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Next Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {schedules.length > 0 ? (
                new Date(
                  Math.min(
                    ...schedules
                      .filter((s: ResearchSchedule) => s.isActive)
                      .map((s: ResearchSchedule) => new Date(s.nextRunAt).getTime())
                  )
                ).toLocaleDateString()
              ) : (
                'No active schedules'
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-green-600">
              <i className="fas fa-clock mr-1"></i>
              Running
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingSchedule) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResearchScheduleForm
              initialData={editingSchedule}
              onSubmit={editingSchedule ? handleUpdateSchedule : handleCreateSchedule}
              onCancel={handleCancelEdit}
              isSubmitting={createScheduleMutation.isPending || updateScheduleMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Schedules List */}
      {!showCreateForm && !editingSchedule && (
        <ResearchSchedulesList
          schedules={schedules}
          onEdit={handleEditSchedule}
          onDelete={handleDeleteSchedule}
          isDeleting={deleteScheduleMutation.isPending}
        />
      )}
    </div>
  );
}