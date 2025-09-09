import { db } from '../../db';
import { researchSchedules, insertResearchScheduleSchema, type InsertResearchSchedule, type ResearchSchedule } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import parser from 'cron-parser';

export class ScheduleService {
  async createSchedule(data: any): Promise<ResearchSchedule> {
    // Validate the input data
    const validatedData = insertResearchScheduleSchema.parse(data);
    
    // Parse and validate cron expression
    let nextRunAt: Date;
    try {
      const interval = parser.parseExpression(validatedData.cronExpression);
      nextRunAt = interval.next().toDate();
    } catch (error) {
      throw new Error('Invalid cron expression - please check the format');
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
      try {
        const interval = parser.parseExpression(data.cronExpression);
        nextRunAt = interval.next().toDate();
      } catch (error) {
        throw new Error('Invalid cron expression - please check the format');
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

    // Calculate next run time
    const interval = parser.parseExpression(schedule.cronExpression);
    const nextRunAt = interval.next().toDate();

    await db
      .update(researchSchedules)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        updatedAt: new Date()
      })
      .where(eq(researchSchedules.id, id));
  }

  // Generate human-readable description from cron expression
  describeCron(cronExpression: string): string {
    try {
      const interval = parser.parseExpression(cronExpression);
      const fields = cronExpression.split(' ');
      
      // Basic patterns
      if (cronExpression === '0 9 * * *') return 'Daily at 9:00 AM';
      if (cronExpression === '0 9 * * 1') return 'Weekly on Monday at 9:00 AM';
      if (cronExpression === '0 9 1 * *') return 'Monthly on the 1st at 9:00 AM';
      if (cronExpression === '0 */4 * * *') return 'Every 4 hours';
      if (cronExpression === '0 9 * * 1-5') return 'Weekdays at 9:00 AM';
      
      // Fallback to showing next few runs
      const next3 = [];
      for (let i = 0; i < 3; i++) {
        next3.push(interval.next().toDate().toLocaleDateString());
      }
      return `Next runs: ${next3.join(', ')}`;
    } catch (error) {
      return 'Invalid schedule';
    }
  }
}

export const scheduleService = new ScheduleService();