import { db } from '../../db';
import { researchPrograms, researchProgramChanges, insertResearchProgramChangeSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ProgramChange {
  changeType: 'new' | 'updated' | 'removed';
  field?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
}

export interface ProgramDiff {
  programId: string;
  changes: ProgramChange[];
  summary: string;
}

export class ChangeDetector {
  
  /**
   * Detects changes in a program and records them
   */
  async detectAndRecordChanges(
    jobId: string,
    programId: string,
    oldData?: any,
    newData?: any,
    isNew: boolean = false
  ): Promise<ProgramDiff | null> {
    
    if (isNew) {
      // Record as new program
      const change = await this.recordChange(jobId, programId, 'new', {
        summary: `New program discovered: ${newData?.title}`,
        diff: { new: newData }
      });
      
      return {
        programId,
        changes: [{
          changeType: 'new',
          newValue: newData,
          timestamp: new Date()
        }],
        summary: `New program discovered`
      };
    }
    
    if (!oldData || !newData) {
      return null;
    }
    
    // Detect specific field changes
    const changes = this.comparePrograms(oldData, newData);
    
    if (changes.length === 0) {
      return null; // No changes detected
    }
    
    // Record the changes
    const diffData = {
      old: oldData,
      new: newData,
      changes: changes.map(change => ({
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue
      }))
    };
    
    await this.recordChange(jobId, programId, 'updated', {
      summary: this.generateChangeSummary(changes),
      diff: diffData
    });
    
    return {
      programId,
      changes,
      summary: this.generateChangeSummary(changes)
    };
  }
  
  /**
   * Compares two program objects and returns detected changes
   */
  private comparePrograms(oldData: any, newData: any): ProgramChange[] {
    const changes: ProgramChange[] = [];
    const fieldsToCheck = ['title', 'summary', 'sourceUrl', 'lastUpdated'];
    
    for (const field of fieldsToCheck) {
      const oldValue = oldData[field];
      const newValue = newData[field];
      
      if (this.hasFieldChanged(oldValue, newValue)) {
        changes.push({
          changeType: 'updated',
          field,
          oldValue,
          newValue,
          timestamp: new Date()
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Determines if a field value has meaningfully changed
   */
  private hasFieldChanged(oldValue: any, newValue: any): boolean {
    // Handle null/undefined comparisons
    if (oldValue === null && newValue === null) return false;
    if (oldValue === undefined && newValue === undefined) return false;
    if ((oldValue === null || oldValue === undefined) && (newValue !== null && newValue !== undefined)) return true;
    if ((newValue === null || newValue === undefined) && (oldValue !== null && oldValue !== undefined)) return true;
    
    // Handle date comparisons
    if (oldValue instanceof Date && newValue instanceof Date) {
      return oldValue.getTime() !== newValue.getTime();
    }
    
    // Handle string comparisons (trim whitespace for meaningful comparison)
    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      return oldValue.trim() !== newValue.trim();
    }
    
    // Default comparison
    return oldValue !== newValue;
  }
  
  /**
   * Records a change in the database
   */
  private async recordChange(
    jobId: string,
    programId: string,
    changeType: string,
    details: { summary: string; diff: any }
  ): Promise<any> {
    
    const changeData = insertResearchProgramChangeSchema.parse({
      jobId,
      programId,
      changeType,
      diff: details.diff
    });
    
    const [change] = await db
      .insert(researchProgramChanges)
      .values(changeData)
      .returning();
    
    console.log(`Recorded ${changeType} change for program ${programId}: ${details.summary}`);
    
    return change;
  }
  
  /**
   * Generates a human-readable summary of changes
   */
  private generateChangeSummary(changes: ProgramChange[]): string {
    if (changes.length === 0) return 'No changes';
    if (changes.length === 1) {
      const change = changes[0];
      return `Updated ${change.field}`;
    }
    
    const fields = changes.map(c => c.field).filter(Boolean);
    return `Updated ${fields.length} fields: ${fields.join(', ')}`;
  }
  
  /**
   * Gets all changes for a specific job
   */
  async getChangesForJob(jobId: string): Promise<any[]> {
    return await db
      .select({
        change: researchProgramChanges,
        program: researchPrograms
      })
      .from(researchProgramChanges)
      .leftJoin(researchPrograms, eq(researchProgramChanges.programId, researchPrograms.id))
      .where(eq(researchProgramChanges.jobId, jobId))
      .orderBy(researchProgramChanges.createdAt) as any;
  }
  
  /**
   * Gets change statistics for analysis
   */
  async getChangeStatistics(filters?: {
    jobId?: string;
    since?: Date;
    changeType?: string;
  }): Promise<{
    total: number;
    byType: Record<string, number>;
    byProgram: Record<string, number>;
  }> {
    
    const conditions: any[] = [];
    
    // Build filter conditions
    if (filters?.jobId) {
      conditions.push(eq(researchProgramChanges.jobId, filters.jobId));
    }
    
    if (filters?.changeType) {
      conditions.push(eq(researchProgramChanges.changeType, filters.changeType));
    }
    
    // Build query with proper where conditions
    let query = db.select().from(researchProgramChanges);
    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }
    
    const allChanges = await query;
    
    // Filter by date if provided
    let filteredChanges = allChanges;
    if (filters?.since) {
      filteredChanges = allChanges.filter(change => 
        change.createdAt >= filters.since!
      );
    }
    
    // Calculate statistics
    const byType: Record<string, number> = {};
    const byProgram: Record<string, number> = {};
    
    for (const change of filteredChanges) {
      // Count by change type
      byType[change.changeType] = (byType[change.changeType] || 0) + 1;
      
      // Count by program (if programId exists)
      if (change.programId) {
        byProgram[change.programId] = (byProgram[change.programId] || 0) + 1;
      }
    }
    
    return {
      total: filteredChanges.length,
      byType,
      byProgram
    };
  }
  
  /**
   * Detects programs that were removed (no longer found in recent research)
   */
  async detectRemovedPrograms(
    jobId: string,
    currentProgramIds: string[],
    scope: { states: string[]; dataTypes: string[] }
  ): Promise<ProgramDiff[]> {
    
    // Find programs that were previously discovered for these states/types
    // but are not in the current results
    const previousPrograms = await db
      .select()
      .from(researchPrograms)
      .where(
        and(
          eq(researchPrograms.state, scope.states[0]), // Simplified for demo
          // Could add more complex filtering here
        )
      );
    
    const removedPrograms = previousPrograms.filter(
      program => !currentProgramIds.includes(program.id)
    );
    
    const removedDiffs: ProgramDiff[] = [];
    
    for (const program of removedPrograms) {
      await this.recordChange(jobId, program.id, 'removed', {
        summary: `Program no longer found: ${program.title}`,
        diff: { removed: program }
      });
      
      removedDiffs.push({
        programId: program.id,
        changes: [{
          changeType: 'removed',
          oldValue: program,
          timestamp: new Date()
        }],
        summary: 'Program no longer found'
      });
    }
    
    return removedDiffs;
  }
}

export const changeDetector = new ChangeDetector();