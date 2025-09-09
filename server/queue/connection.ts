import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../db';
import { fetchJobs, insertFetchJobSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface QueueConnection {
  addJob(name: string, data: any, options?: any): Promise<any>;
  getJob(id: string): Promise<any>;
  getJobs(statuses: string[]): Promise<any[]>;
  close(): Promise<void>;
}

export class RedisQueueConnection implements QueueConnection {
  private redis: IORedis;
  private queue: Queue;
  private queueEvents: QueueEvents;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    this.queue = new Queue('research-queue', { connection: this.redis });
    this.queueEvents = new QueueEvents('research-queue', { connection: this.redis });
  }

  async addJob(name: string, data: any, options: any = {}): Promise<any> {
    return await this.queue.add(name, data, options);
  }

  async getJob(id: string): Promise<any> {
    return await this.queue.getJob(id);
  }

  async getJobs(statuses: string[]): Promise<any[]> {
    const jobs = [];
    for (const status of statuses) {
      const statusJobs = await this.queue.getJobs([status as any], 0, 100);
      jobs.push(...statusJobs);
    }
    return jobs;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    await this.redis.quit();
  }
}

export class DatabaseQueueConnection implements QueueConnection {
  async addJob(name: string, data: any, options: any = {}): Promise<any> {
    const jobData = insertFetchJobSchema.parse({
      state: data.state,
      dataTypes: data.dataTypes,
      status: 'queued',
      statsJson: options.stats || {}
    });

    const [job] = await db.insert(fetchJobs).values(jobData).returning();
    
    // Simulate job processing in next tick
    process.nextTick(() => this.processJob(job.id, data));
    
    return { id: job.id, name, data };
  }

  async getJob(id: string): Promise<any> {
    const [job] = await db.select().from(fetchJobs).where(eq(fetchJobs.id, id));
    if (!job) return null;
    
    return {
      id: job.id,
      name: 'state-research',
      data: { state: job.state, dataTypes: job.dataTypes },
      opts: { stats: job.statsJson },
      processedOn: job.startedAt?.getTime(),
      finishedOn: job.finishedAt?.getTime(),
      returnvalue: job.status === 'success' ? 'completed' : undefined,
      failedReason: job.errorText,
      progress: job.status === 'running' ? 50 : (job.status === 'success' ? 100 : 0),
    };
  }

  async getJobs(statuses: string[]): Promise<any[]> {
    // Map BullMQ status names to database status names
    const statusMap: Record<string, string> = {
      'waiting': 'queued',
      'active': 'running', 
      'completed': 'success',
      'failed': 'error'
    };

    const dbStatuses = statuses.map(status => statusMap[status] || status);
    const jobs = await db.select().from(fetchJobs);
    
    return jobs
      .filter(job => dbStatuses.includes(job.status))
      .map(job => ({
        id: job.id,
        name: 'state-research',
        data: { state: job.state, dataTypes: job.dataTypes },
        opts: { stats: job.statsJson },
        processedOn: job.startedAt?.getTime(),
        finishedOn: job.finishedAt?.getTime(),
        returnvalue: job.status === 'success' ? 'completed' : undefined,
        failedReason: job.errorText,
        progress: job.status === 'running' ? 50 : (job.status === 'success' ? 100 : 0),
      }))
      .sort((a, b) => (b.finishedOn || b.processedOn || 0) - (a.finishedOn || a.processedOn || 0)); // Sort by most recent first
  }

  async close(): Promise<void> {
    // Nothing to close for database connection
  }

  private async processJob(jobId: string, data: any): Promise<void> {
    try {
      // Update job to running
      await db.update(fetchJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(fetchJobs.id, jobId));

      // Import and run the research worker
      const workerModule = await import('../workers/researchWorker');
      await workerModule.processResearchJob(jobId, data);

      // Update job to success
      await db.update(fetchJobs)
        .set({ 
          status: 'success', 
          finishedAt: new Date(),
          statsJson: { completed: true, timestamp: new Date().toISOString() }
        })
        .where(eq(fetchJobs.id, jobId));

    } catch (error) {
      console.error('Database queue job failed:', error);
      await db.update(fetchJobs)
        .set({ 
          status: 'error', 
          finishedAt: new Date(),
          errorText: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(fetchJobs.id, jobId));
    }
  }
}

// Create queue connection with Redis fallback
export async function createQueueConnection(): Promise<QueueConnection> {
  try {
    const redisConnection = new RedisQueueConnection();
    // Test Redis connection
    await redisConnection.addJob('test', {}, { removeOnComplete: 1 });
    console.log('✓ Connected to Redis for queue');
    return redisConnection;
  } catch (error) {
    console.log('✗ Redis unavailable, falling back to database queue');
    return new DatabaseQueueConnection();
  }
}

export let queueConnection: QueueConnection;

export async function initializeQueue(): Promise<void> {
  queueConnection = await createQueueConnection();
}