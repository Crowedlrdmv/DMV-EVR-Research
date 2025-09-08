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
  state: string;
  dataTypes: string[];
  status: string;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
  stats?: any;
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
    
    return queueJobs
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
        id: job.id,
        state: job.data.state,
        dataTypes: job.data.dataTypes,
        status: this.mapJobStatus(job),
        startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        error: job.failedReason,
        stats: job.opts?.stats
      }));
  }

  async getJob(id: string): Promise<ResearchJobSummary | null> {
    const job = await queueConnection.getJob(id);
    if (!job) return null;

    return {
      id: job.id,
      state: job.data.state,
      dataTypes: job.data.dataTypes,
      status: this.mapJobStatus(job),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      error: job.failedReason,
      stats: job.opts?.stats
    };
  }

  async getResearchResults(filters: { state?: string; since?: string } = {}) {
    if (filters.state) {
      return await db.select({
        id: programs.id,
        state: programs.state,
        type: programs.type,
        title: programs.title,
        url: programs.url,
        summary: programs.summary,
        lastUpdated: programs.lastUpdated,
        createdAt: programs.createdAt
      })
      .from(programs)
      .where(eq(programs.state, filters.state.toUpperCase()))
      .orderBy(desc(programs.createdAt))
      .limit(100);
    }

    return await db.select({
      id: programs.id,
      state: programs.state,
      type: programs.type,
      title: programs.title,
      url: programs.url,
      summary: programs.summary,
      lastUpdated: programs.lastUpdated,
      createdAt: programs.createdAt
    })
    .from(programs)
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