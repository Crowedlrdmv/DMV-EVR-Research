import { db } from '../../db';
import { researchPrograms, researchJobResults, insertResearchProgramSchema, insertResearchJobResultSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { generateStableKey, normalizeProgram } from '../../utils/stableKey';

export class ProgramService {
  
  /**
   * Upserts a research program using stable_key for deduplication
   * Returns the program ID and whether it was newly created
   */
  async upsertProgram(data: {
    state: string;
    type: string;
    title: string;
    summary?: string;
    sourceUrl?: string;
    lastUpdated?: Date;
  }): Promise<{ id: string; isNew: boolean; program: any }> {
    
    // Normalize the program data
    const normalized = normalizeProgram(data);
    
    // Generate stable key for deduplication
    const stableKey = generateStableKey(normalized);
    
    // Check if program already exists
    const existing = await db
      .select()
      .from(researchPrograms)
      .where(eq(researchPrograms.stableKey, stableKey))
      .limit(1);
    
    if (existing.length > 0) {
      const program = existing[0];
      
      // Update last_seen_at and potentially other fields
      const updateData: any = {
        lastSeenAt: new Date(),
      };
      
      // Update last_updated if provided and newer
      if (normalized.lastUpdated && 
          (!program.lastUpdated || normalized.lastUpdated > program.lastUpdated)) {
        updateData.lastUpdated = normalized.lastUpdated;
      }
      
      // Update summary if provided and different
      if (normalized.summary && normalized.summary !== program.summary) {
        updateData.summary = normalized.summary;
      }
      
      // Update source URL if provided and different
      if (normalized.sourceUrl && normalized.sourceUrl !== program.sourceUrl) {
        updateData.sourceUrl = normalized.sourceUrl;
      }
      
      const [updated] = await db
        .update(researchPrograms)
        .set(updateData)
        .where(eq(researchPrograms.id, program.id))
        .returning();
      
      return { id: program.id, isNew: false, program: updated };
    }
    
    // Create new program
    const programData = insertResearchProgramSchema.parse({
      stableKey,
      state: normalized.state,
      type: normalized.type,
      title: normalized.title,
      summary: normalized.summary,
      sourceUrl: normalized.sourceUrl,
      lastUpdated: normalized.lastUpdated,
    });
    
    const [newProgram] = await db
      .insert(researchPrograms)
      .values(programData)
      .returning();
    
    return { id: newProgram.id, isNew: true, program: newProgram };
  }
  
  /**
   * Links a program to a research job
   */
  async linkProgramToJob(programId: string, jobId: string): Promise<void> {
    const linkData = insertResearchJobResultSchema.parse({
      programId,
      jobId,
    });
    
    // Use ON CONFLICT DO NOTHING equivalent (check first)
    const existing = await db
      .select()
      .from(researchJobResults)
      .where(and(
        eq(researchJobResults.programId, programId),
        eq(researchJobResults.jobId, jobId)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(researchJobResults).values(linkData);
    }
  }
  
  /**
   * Gets programs linked to a specific job
   */
  async getProgramsForJob(jobId: string) {
    return await db
      .select({
        program: researchPrograms,
        link: researchJobResults,
      })
      .from(researchJobResults)
      .innerJoin(researchPrograms, eq(researchJobResults.programId, researchPrograms.id))
      .where(eq(researchJobResults.jobId, jobId));
  }
  
  /**
   * Gets all programs with optional filtering
   */
  async getPrograms(filters?: {
    state?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(researchPrograms);
    
    if (filters?.state) {
      query = query.where(eq(researchPrograms.state, filters.state.toUpperCase()));
    }
    
    if (filters?.type) {
      query = query.where(eq(researchPrograms.type, filters.type.toLowerCase()));
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }
  
  /**
   * Counts total programs with optional filtering
   */
  async countPrograms(filters?: {
    state?: string;
    type?: string;
  }): Promise<number> {
    let query = db.select({ count: researchPrograms.id }).from(researchPrograms);
    
    if (filters?.state) {
      query = query.where(eq(researchPrograms.state, filters.state.toUpperCase()));
    }
    
    if (filters?.type) {
      query = query.where(eq(researchPrograms.type, filters.type.toLowerCase()));
    }
    
    const result = await query;
    return result.length;
  }
}

export const programService = new ProgramService();