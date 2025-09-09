import { queueConnection } from '../../queue/connection';
import { db } from '../../db';
import { fetchJobs, programs, fetchArtifacts } from '@shared/schema';
import { eq, and, desc, count, gte } from 'drizzle-orm';

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
    // Build base query
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
      .from(programs)
      .orderBy(desc(programs.createdAt))
      .limit(100);

    // Execute query and filter in memory for simplicity
    const results = await query;
    
    // Apply filters in memory
    let filtered = results;
    
    if (filters.jobId) {
      filtered = filtered.filter(program => program.jobId === filters.jobId);
    }
    
    if (filters.state) {
      filtered = filtered.filter(program => program.state === filters.state!.toUpperCase());
    }
    
    return filtered;
  }

  async getResearchDeltas(filters: { state?: string; since?: string } = {}) {
    const cutoffDate = filters.since ? new Date(filters.since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days

    // Get programs in date range with their creation and update timestamps
    let query = db
      .select({
        id: programs.id,
        title: programs.title,
        url: programs.url,
        state: programs.state,
        type: programs.type,
        jobId: programs.jobId,
        createdAt: programs.createdAt,
        lastUpdated: programs.lastUpdated,
      })
      .from(programs)
      .where(gte(programs.createdAt, cutoffDate))
      .orderBy(desc(programs.createdAt));

    if (filters.state) {
      query = query.where(and(
        gte(programs.createdAt, cutoffDate),
        eq(programs.state, filters.state.toUpperCase())
      ));
    }

    const recentPrograms = await query;

    // Identify changes based on creation and update patterns
    const changes = recentPrograms.map(program => {
      const isNew = program.createdAt >= cutoffDate;
      const isUpdated = program.lastUpdated && program.lastUpdated > program.createdAt;

      return {
        id: program.id,
        title: program.title,
        url: program.url,
        state: program.state,
        type: program.type,
        jobId: program.jobId,
        changeType: isUpdated ? 'updated' : (isNew ? 'new' : 'unchanged'),
        timestamp: program.lastUpdated || program.createdAt,
        details: isUpdated ? 'Content or metadata updated' : (isNew ? 'Newly discovered program' : 'No changes')
      };
    });

    // Return only actual changes (new or updated)
    return changes.filter(change => change.changeType !== 'unchanged');
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

  async getResearchAnalytics(days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Job completion trends
    const jobTrends = await db
      .select({
        date: fetchJobs.createdAt,
        status: fetchJobs.status,
        state: fetchJobs.state,
        programCount: count()
      })
      .from(fetchJobs)
      .where(eq(fetchJobs.createdAt, cutoffDate))
      .groupBy(fetchJobs.createdAt, fetchJobs.status, fetchJobs.state)
      .orderBy(desc(fetchJobs.createdAt));

    // Data type coverage
    const dataTypeCoverage = await db
      .select({
        type: programs.type,
        count: count(),
        state: programs.state
      })
      .from(programs)
      .groupBy(programs.type, programs.state);

    // Source validation stats
    const sourceValidation = await db
      .select({
        sourceValid: programs.sourceValid,
        count: count()
      })
      .from(programs)
      .groupBy(programs.sourceValid);

    // Program discovery trends (programs found per day)
    const programTrends = await db
      .select({
        date: programs.createdAt,
        count: count()
      })
      .from(programs)
      .where(eq(programs.createdAt, cutoffDate))
      .groupBy(programs.createdAt)
      .orderBy(desc(programs.createdAt));

    return {
      jobTrends,
      dataTypeCoverage: dataTypeCoverage.reduce((acc: Record<string, any>, item) => {
        if (!acc[item.type]) acc[item.type] = {};
        acc[item.type][item.state] = item.count;
        return acc;
      }, {}),
      sourceValidation: sourceValidation.reduce((acc: Record<string, number>, item) => {
        const key = item.sourceValid ? 'valid' : 'invalid';
        acc[key] = item.count;
        return acc;
      }, { valid: 0, invalid: 0 }),
      programTrends
    };
  }

  async getResearchSources() {
    // Get unique sources by state from actual artifacts in the database
    const uniqueSources = await db
      .selectDistinct({
        state: fetchArtifacts.sourceId,
        url: fetchArtifacts.url,
        contentType: fetchArtifacts.contentType
      })
      .from(fetchArtifacts)
      .orderBy(fetchArtifacts.sourceId);

    // Group by state and create source objects
    const sourcesByState: Record<string, any[]> = {};
    
    for (const source of uniqueSources) {
      const stateCode = source.state?.split('-')[0] || 'UNKNOWN';
      const dataType = source.state?.split('-')[1] || 'general';
      
      if (!sourcesByState[stateCode]) {
        sourcesByState[stateCode] = [];
      }
      
      sourcesByState[stateCode].push({
        id: source.state,
        name: `${stateCode} ${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`,
        supports: [dataType],
        url: source.url,
        contentType: source.contentType
      });
    }

    return sourcesByState;
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