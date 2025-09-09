import { db } from '../../db';
import { researchSchedules, insertResearchScheduleSchema, type InsertResearchSchedule, type ResearchSchedule } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
// Note: cron-parser imports temporarily disabled due to ESM compatibility issues

export class ScheduleService {
  async createSchedule(data: any): Promise<ResearchSchedule> {
    // Validate the input data
    const validatedData = insertResearchScheduleSchema.parse(data);
    
    // Calculate next run based on simple cron pattern matching
    // TODO: Replace with proper cron-parser once import issues are resolved
    let nextRunAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours from now
    
    // Simple cron expression handling for common patterns
    const cronExpr = validatedData.cronExpression;
    if (cronExpr === '0 9 * * *') {
      // Daily at 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      nextRunAt = tomorrow;
    } else if (cronExpr === '0 9 * * 1') {
      // Weekly on Monday at 9 AM
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);
      nextRunAt = nextWeek;
    }

    // Insert the schedule
    const [schedule] = await db
      .insert(researchSchedules)
      .values({
        ...validatedData,
        nextRunAt
      })
      .returning();
    
    return schedule;
  }

  async getSchedules(): Promise<ResearchSchedule[]> {
    return await db
      .select()
      .from(researchSchedules)
      .orderBy(desc(researchSchedules.createdAt));
  }

  async getSchedule(id: string): Promise<ResearchSchedule | null> {
    const [schedule] = await db
      .select()
      .from(researchSchedules)
      .where(eq(researchSchedules.id, id))
      .limit(1);
    
    return schedule || null;
  }

  async updateSchedule(id: string, data: Partial<InsertResearchSchedule>): Promise<ResearchSchedule | null> {
    const existing = await this.getSchedule(id);
    if (!existing) return null;

    // If cron expression is being updated, calculate next run time
    let nextRunAt = existing.nextRunAt;
    if (data.cronExpression && data.cronExpression !== existing.cronExpression) {
      // Simple cron expression handling
      if (data.cronExpression === '0 9 * * *') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        nextRunAt = tomorrow;
      } else {
        nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }

    const [updated] = await db
      .update(researchSchedules)
      .set({
        ...data,
        nextRunAt,
        updatedAt: new Date()
      })
      .where(eq(researchSchedules.id, id))
      .returning();
    
    return updated;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const result = await db
      .delete(researchSchedules)
      .where(eq(researchSchedules.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getActiveSchedules(): Promise<ResearchSchedule[]> {
    return await db
      .select()
      .from(researchSchedules)
      .where(eq(researchSchedules.isActive, true))
      .orderBy(researchSchedules.nextRunAt);
  }

  async getSchedulesDueForExecution(): Promise<ResearchSchedule[]> {
    const now = new Date();
    return await db
      .select()
      .from(researchSchedules)
      .where(eq(researchSchedules.isActive, true))
      .orderBy(researchSchedules.nextRunAt);
  }

  async updateLastRun(id: string): Promise<void> {
    const schedule = await this.getSchedule(id);
    if (!schedule) return;

    // Calculate next run time based on cron expression
    let nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (schedule.cronExpression === '0 9 * * *') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      nextRunAt = tomorrow;
    }

    await db
      .update(researchSchedules)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        updatedAt: new Date()
      })
      .where(eq(researchSchedules.id, id));
  }

  /**
   * Executes a scheduled research job
   */
  async executeSchedule(schedule: ResearchSchedule): Promise<{ success: boolean; jobIds?: string[]; error?: string }> {
    try {
      console.log(`Executing scheduled research: ${schedule.name}`);
      
      // Import research service and start job
      const { researchService } = await import('./researchService');
      
      const jobIds = await researchService.startResearchJob({
        states: schedule.states,
        dataTypes: schedule.dataTypes,
        depth: schedule.depth as 'summary' | 'full',
        since: undefined
      });
      
      // Update last execution time
      await this.updateLastRun(schedule.id);
      
      console.log(`Successfully executed schedule ${schedule.name}, started ${jobIds.length} jobs`);
      
      return { success: true, jobIds };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to execute schedule ${schedule.name}:`, error);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Starts the scheduler engine to run all active schedules
   */
  async startSchedulerEngine(): Promise<void> {
    console.log('Starting research scheduler engine...');
    
    // Start checking for schedules every minute
    setInterval(async () => {
      try {
        const dueSchedules = await this.getSchedulesDueForExecution();
        
        for (const schedule of dueSchedules) {
          if (schedule.nextRunAt && schedule.nextRunAt <= new Date()) {
            // Execute the schedule in background
            this.executeSchedule(schedule).catch(error => {
              console.error(`Background execution failed for ${schedule.name}:`, error);
            });
          }
        }
      } catch (error) {
        console.error('Scheduler engine error:', error);
      }
    }, 60 * 1000); // Check every minute
    
    console.log('Scheduler engine started - checking for due schedules every minute');
  }

  /**
   * Gets upcoming scheduled executions
   */
  async getUpcomingExecutions(hours: number = 24): Promise<any[]> {
    const schedules = await db
      .select()
      .from(researchSchedules)
      .where(eq(researchSchedules.isActive, true));
    
    const upcoming = [];
    const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    for (const schedule of schedules) {
      if (schedule.nextRunAt && schedule.nextRunAt <= cutoff) {
        upcoming.push({
          schedule,
          nextExecution: schedule.nextRunAt,
          timeUntil: schedule.nextRunAt.getTime() - Date.now()
        });
      }
    }
    
    return upcoming.sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime());
  }

  // Generate human-readable description from cron expression
  describeCron(cronExpression: string): string {
    // Basic patterns without requiring cron parser
    if (cronExpression === '0 9 * * *') return 'Daily at 9:00 AM';
    if (cronExpression === '0 9 * * 1') return 'Weekly on Monday at 9:00 AM';
    if (cronExpression === '0 9 1 * *') return 'Monthly on the 1st at 9:00 AM';
    if (cronExpression === '0 */4 * * *') return 'Every 4 hours';
    if (cronExpression === '0 9 * * 1-5') return 'Weekdays at 9:00 AM';
    
    return `Custom schedule: ${cronExpression}`;
  }
}

export const scheduleService = new ScheduleService();