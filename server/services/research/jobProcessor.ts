import { db } from '../../db';
import { researchJobs, researchArtifacts, insertResearchArtifactSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { programService } from './programService';
import { changeDetector } from './changeDetector';

export class JobProcessor {
  
  /**
   * Processes a research job with proper lifecycle management
   */
  async processResearchJob(jobId: string, data: any): Promise<void> {
    console.log(`Starting job processing for ${jobId}`);
    
    try {
      // Update job to running status
      await this.updateJobStatus(jobId, 'running', new Date());
      
      // Simulate research processing with proper program handling
      const results = await this.performResearch(jobId, data);
      
      // Update job completion
      await this.updateJobStatus(jobId, 'succeeded', undefined, new Date(), {
        resultCount: results.programCount,
        artifactCount: results.artifactCount
      });
      
      console.log(`Job ${jobId} completed successfully with ${results.programCount} programs and ${results.artifactCount} artifacts`);
      
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      
      // Update job to failed status with error message
      await this.updateJobStatus(jobId, 'failed', undefined, new Date(), undefined, 
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }
  
  /**
   * Updates job status with proper timestamp tracking
   */
  private async updateJobStatus(
    jobId: string, 
    status: string, 
    startedAt?: Date, 
    finishedAt?: Date, 
    counts?: { resultCount?: number; artifactCount?: number },
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (startedAt) updateData.startedAt = startedAt;
    if (finishedAt) updateData.finishedAt = finishedAt;
    if (counts?.resultCount !== undefined) updateData.resultCount = counts.resultCount;
    if (counts?.artifactCount !== undefined) updateData.artifactCount = counts.artifactCount;
    if (errorMessage) updateData.errorMessage = errorMessage;
    
    await db
      .update(researchJobs)
      .set(updateData)
      .where(eq(researchJobs.id, jobId));
    
    console.log(`Updated job ${jobId} to status: ${status}`);
  }
  
  /**
   * Simulates research processing with proper program deduplication
   */
  private async performResearch(jobId: string, data: any): Promise<{ programCount: number; artifactCount: number }> {
    const { states, dataTypes, depth } = data;
    
    let totalPrograms = 0;
    let totalArtifacts = 0;
    
    // Process each state
    for (const state of states) {
      console.log(`Processing research for state: ${state}`);
      
      // Simulate artifact creation
      const artifacts = await this.createResearchArtifacts(jobId, state, dataTypes);
      totalArtifacts += artifacts.length;
      
      // Simulate program discovery and deduplication
      const programs = await this.discoverPrograms(jobId, state, dataTypes, depth);
      totalPrograms += programs.length;
      
      // Small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { programCount: totalPrograms, artifactCount: totalArtifacts };
  }
  
  /**
   * Creates research artifacts for tracking
   */
  private async createResearchArtifacts(jobId: string, state: string, dataTypes: string[]): Promise<any[]> {
    const artifacts = [];
    
    for (const dataType of dataTypes) {
      // Create artifact for each data type
      const artifactData = insertResearchArtifactSchema.parse({
        jobId,
        artifactType: dataType,
        url: `https://dmv.${state.toLowerCase()}.gov/${dataType}`,
        status: 'processed'
      });
      
      const [artifact] = await db
        .insert(researchArtifacts)
        .values(artifactData)
        .returning();
      
      artifacts.push(artifact);
    }
    
    return artifacts;
  }
  
  /**
   * Discovers and deduplicates programs using stable_key logic
   */
  private async discoverPrograms(jobId: string, state: string, dataTypes: string[], depth: string): Promise<any[]> {
    const programs = [];
    
    // Simulate discovering programs for each data type
    for (const dataType of dataTypes) {
      const programCount = depth === 'full' ? 5 : 2; // More programs for full depth
      
      for (let i = 0; i < programCount; i++) {
        // Create simulated program data
        const programData = {
          state: state.toUpperCase(),
          type: dataType,
          title: `${state} ${dataType} Program ${i + 1}`,
          summary: `This is a ${dataType} compliance program for ${state}`,
          sourceUrl: `https://dmv.${state.toLowerCase()}.gov/${dataType}/program-${i + 1}`,
          lastUpdated: new Date()
        };
        
        // Use stable_key deduplication logic
        const result = await programService.upsertProgram(programData);
        
        // Detect and record changes
        const existingProgram = result.isNew ? null : result.program;
        await changeDetector.detectAndRecordChanges(
          jobId,
          result.id,
          existingProgram,
          programData,
          result.isNew
        );
        
        // Link program to job
        await programService.linkProgramToJob(result.id, jobId);
        
        programs.push(result.program);
        
        if (result.isNew) {
          console.log(`Discovered new program: ${programData.title} (${result.id})`);
        } else {
          console.log(`Updated existing program: ${programData.title} (${result.id})`);
        }
      }
    }
    
    return programs;
  }
  
  /**
   * Handles job failures with proper cleanup
   */
  async handleJobFailure(jobId: string, error: Error): Promise<void> {
    try {
      // Log detailed error information
      console.error(`Job ${jobId} failed with error:`, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Update job status to failed
      await this.updateJobStatus(jobId, 'failed', undefined, new Date(), undefined, error.message);
      
      // Could add additional cleanup logic here if needed
      // For example: cleaning up partial results, sending notifications, etc.
      
    } catch (cleanupError) {
      console.error(`Failed to handle job failure for ${jobId}:`, cleanupError);
    }
  }
  
  /**
   * Validates job data before processing
   */
  validateJobData(data: any): boolean {
    if (!data.states || !Array.isArray(data.states) || data.states.length === 0) {
      throw new Error('Job data must include valid states array');
    }
    
    if (!data.dataTypes || !Array.isArray(data.dataTypes) || data.dataTypes.length === 0) {
      throw new Error('Job data must include valid dataTypes array');
    }
    
    if (!data.depth || !['summary', 'full'].includes(data.depth)) {
      throw new Error('Job data must include valid depth (summary or full)');
    }
    
    return true;
  }
}

export const jobProcessor = new JobProcessor();