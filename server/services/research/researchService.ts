import { queueConnection } from '../../queue/connection';
import { db } from '../../db';
import { fetchJobs, programs, fetchArtifacts } from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';

export interface StartResearchJobRequest {
  states: string[];
  dataTypes: string[];
  depth: 'summary' | 'full';
  since?: string;
}

export interface ResearchJobSummary {
  id: string;
  states: string[];
  dataTypes: string[];
  depth: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  errorText?: string;
  stats?: { artifacts?: number; programs?: number };
  logs?: string[];
}

export class ResearchService {
  async startResearchJob(request: StartResearchJobRequest): Promise<string[]> {
    const jobIds: string[] = [];

    // Check for overlapping jobs
    for (const state of request.states) {
      await this.checkForOverlappingJobs(state, request.dataTypes);
    }

    // Create one job per state
    for (const state of request.states) {
      const job = await queueConnection.addJob('state-research', {
        state: state.toUpperCase(),
        dataTypes: request.dataTypes,
        depth: request.depth,
        since: request.since
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5
      });

      jobIds.push(job.id);
    }

    return jobIds;
  }

  async getJobs(filters: { status?: string; state?: string } = {}): Promise<ResearchJobSummary[]> {
    const queueJobs = await queueConnection.getJobs(['waiting', 'active', 'completed', 'failed']);
    
    const jobs = queueJobs
      .filter(job => {
        if (filters.status && job.returnvalue !== filters.status && 
            !(filters.status === 'running' && !job.finishedOn && job.processedOn)) {
          return false;
        }
        if (filters.state && job.data.state !== filters.state.toUpperCase()) {
          return false;
        }
        return true;
      })
      .map(job => ({
        id: String(job.id || 'unknown'),
        states: job.data?.state ? [job.data.state] : [],
        dataTypes: Array.isArray(job.data?.dataTypes) ? job.data.dataTypes : [],
        depth: job.data?.depth || 'summary',
        status: this.mapJobStatus(job),
        startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : new Date().toISOString(),
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
        errorText: job.failedReason || undefined,
        stats: job.opts?.stats || { artifacts: 0, programs: 0 },
        logs: Array.isArray(job.logs) ? job.logs : []
      }));

    // Enhance with actual database stats for completed jobs
    for (const job of jobs) {
      if (job.status === 'success') {
        job.stats = await this.getJobStats(job.id);
      }
    }

    return jobs;
  }

  async getJob(id: string): Promise<ResearchJobSummary | null> {
    const job = await queueConnection.getJob(id);
    if (!job) return null;

    return {
      id: String(job.id || 'unknown'),
      states: job.data?.state ? [job.data.state] : [],
      dataTypes: Array.isArray(job.data?.dataTypes) ? job.data.dataTypes : [],
      depth: job.data?.depth || 'summary',
      status: this.mapJobStatus(job),
      startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : new Date().toISOString(),
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      errorText: job.failedReason || undefined,
      stats: job.opts?.stats || { artifacts: 0, programs: 0 },
      logs: Array.isArray(job.logs) ? job.logs : []
    };
  }

  async getResearchResults(filters: { state?: string; since?: string; jobId?: string } = {}) {
    // Build the query without conditions first
    let query = db
      .select({
        id: programs.id,
        jobId: programs.jobId,
        state: programs.state,
        type: programs.type,
        title: programs.title,
        url: programs.url,
        summary: programs.summary,
        lastUpdated: programs.lastUpdated,
        createdAt: programs.createdAt,
        sourceValid: programs.sourceValid,
        sourceReason: programs.sourceReason,
        httpStatus: programs.httpStatus,
        checkedAt: programs.checkedAt,
        isDemo: programs.isDemo
      })
      .from(programs);

    // Build where conditions
    const whereConditions = [];
    
    if (filters.jobId) {
      whereConditions.push(eq(programs.jobId, filters.jobId));
    }
    
    if (filters.state) {
      whereConditions.push(eq(programs.state, filters.state.toUpperCase()));
    }
    
    // Apply where conditions if any exist
    if (whereConditions.length > 0) {
      query = query.where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions));
    }

    return await query
      .orderBy(desc(programs.createdAt))
      .limit(100);
  }

  async getResearchDeltas(filters: { state?: string; since?: string } = {}) {
    // For MVP, return empty array - will implement with change detection
    return [];
  }

  async getResearchStats() {
    const [totalPrograms] = await db.select({ count: count() }).from(programs);
    const [totalArtifacts] = await db.select({ count: count() }).from(fetchArtifacts);
    
    // Get programs by state
    const programsByState = await db.select({
      state: programs.state,
      count: count()
    })
    .from(programs)
    .groupBy(programs.state);

    return {
      totalPrograms: totalPrograms.count,
      totalArtifacts: totalArtifacts.count,
      programsByState: programsByState.reduce((acc: Record<string, number>, item) => {
        acc[item.state] = item.count;
        return acc;
      }, {})
    };
  }

  async getJobStats(jobId: string): Promise<{ artifacts: number; programs: number }> {
    const [programCount] = await db
      .select({ count: count() })
      .from(programs)
      .where(eq(programs.jobId, jobId));

    const [artifactCount] = await db
      .select({ count: count() })
      .from(fetchArtifacts)
      .where(eq(fetchArtifacts.jobId, jobId));

    return {
      programs: programCount.count,
      artifacts: artifactCount.count
    };
  }

  private async checkForOverlappingJobs(state: string, dataTypes: string[]): Promise<void> {
    const runningJobs = await this.getJobs({ status: 'running', state });
    
    if (runningJobs.length > 0) {
      throw new Error(`Research job already running for state ${state}`);
    }
  }

  private mapJobStatus(job: any): string {
    if (job.finishedOn && job.returnvalue) return 'success';
    if (job.finishedOn && job.failedReason) return 'error';
    if (job.processedOn && !job.finishedOn) return 'running';
    return 'queued';
  }
}

export const researchService = new ResearchService();