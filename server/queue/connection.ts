import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../db';
import { researchJobs, insertResearchJobSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface QueueConnection {
  addJob(name: string, data: any, options?: any): Promise<any>;
  getJob(id: string): Promise<any>;
  getJobs(statuses: string[]): Promise<any[]>;
  getWaiting(): Promise<any[]>;
  getActive(): Promise<any[]>;
  getCompleted(): Promise<any[]>;
  getFailed(): Promise<any[]>;
  close(): Promise<void>;
}

export class RedisQueueConnection implements QueueConnection {
  private redis: IORedis;
  private queue: Queue;
  private queueEvents: QueueEvents;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: false,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });

    // Suppress Redis connection error logs
    this.redis.on('error', (err) => {
      // Silently handle Redis connection errors since we have a fallback
    });

    this.redis.on('connect', () => {
      console.log('✓ Redis queue connection established');
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

  async getWaiting(): Promise<any[]> {
    return await this.queue.getJobs(['waiting'], 0, 100);
  }

  async getActive(): Promise<any[]> {
    return await this.queue.getJobs(['active'], 0, 100);
  }

  async getCompleted(): Promise<any[]> {
    return await this.queue.getJobs(['completed'], 0, 100);
  }

  async getFailed(): Promise<any[]> {
    return await this.queue.getJobs(['failed'], 0, 100);
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    await this.redis.quit();
  }
}

export class DatabaseQueueConnection implements QueueConnection {
  async addJob(name: string, data: any, options: any = {}): Promise<any> {
    const jobData = insertResearchJobSchema.parse({
      states: Array.isArray(data.states) ? data.states : [data.state || data.states],
      dataTypes: data.dataTypes,
      depth: data.depth || 'summary',
      status: 'queued'
    });

    const [job] = await db.insert(researchJobs).values(jobData).returning();
    
    // Simulate job processing in next tick
    process.nextTick(() => this.processJob(job.id, data));
    
    return { id: job.id, name, data };
  }

  async getJob(id: string): Promise<any> {
    const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, id));
    if (!job) return null;
    
    return {
      id: job.id,
      name: 'state-research',
      data: { states: job.states, dataTypes: job.dataTypes, depth: job.depth },
      opts: {},
      processedOn: job.startedAt?.getTime(),
      finishedOn: job.finishedAt?.getTime(),
      returnvalue: job.status === 'succeeded' ? 'completed' : undefined,
      failedReason: job.errorMessage,
      progress: job.status === 'succeeded' ? 100 : job.status === 'running' ? 50 : 0,
    };
  }

  async getJobs(statuses: string[]): Promise<any[]> {
    // Map BullMQ status names to database status names
    const statusMap: Record<string, string> = {
      'waiting': 'queued',
      'active': 'running', 
      'completed': 'succeeded',
      'failed': 'failed'
    };

    const dbStatuses = statuses.map(status => statusMap[status] || status);
    const jobs = await db.select().from(researchJobs);
    
    return jobs
      .filter(job => dbStatuses.includes(job.status))
      .map(job => ({
        id: job.id,
        name: 'state-research',
        data: { states: job.states, dataTypes: job.dataTypes, depth: job.depth },
        opts: {},
        processedOn: job.startedAt?.getTime(),
        finishedOn: job.finishedAt?.getTime(),
        returnvalue: job.status === 'succeeded' ? 'completed' : undefined,
        failedReason: job.errorMessage,
        progress: job.status === 'succeeded' ? 100 : job.status === 'running' ? 50 : 0,
      }))
      .sort((a, b) => (b.finishedOn || b.processedOn || 0) - (a.finishedOn || a.processedOn || 0)); // Sort by most recent first
  }

  async getWaiting(): Promise<any[]> {
    return await this.getJobs(['waiting']);
  }

  async getActive(): Promise<any[]> {
    return await this.getJobs(['active']);
  }

  async getCompleted(): Promise<any[]> {
    return await this.getJobs(['completed']);
  }

  async getFailed(): Promise<any[]> {
    return await this.getJobs(['failed']);
  }

  async close(): Promise<void> {
    // Nothing to close for database connection
  }

  private async processJob(jobId: string, data: any): Promise<void> {
    try {
      // Update job to running
      await db.update(researchJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(researchJobs.id, jobId));

      // Import and run the job processor
      const { jobProcessor } = await import('../services/research/jobProcessor');
      await jobProcessor.processResearchJob(jobId, data);

      // Update job to succeeded
      await db.update(researchJobs)
        .set({ 
          status: 'succeeded', 
          finishedAt: new Date()
        })
        .where(eq(researchJobs.id, jobId));

    } catch (error) {
      console.error('Database queue job failed:', error);
      await db.update(researchJobs)
        .set({ 
          status: 'failed', 
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(researchJobs.id, jobId));
    }
  }
}

// Create queue connection with Redis fallback
async function isRedisAvailable(): Promise<boolean> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const testClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      connectTimeout: 1000,
    });
    
    // Suppress error logs for test connection
    testClient.on('error', () => {});
    
    await testClient.ping();
    await testClient.quit();
    return true;
  } catch {
    return false;
  }
}

export async function createQueueConnection(): Promise<QueueConnection> {
  const redisAvailable = await isRedisAvailable();
  
  if (!redisAvailable) {
    console.log('✗ Redis unavailable, using database queue');
    return new DatabaseQueueConnection();
  }

  try {
    const redisConnection = new RedisQueueConnection();
    // Test Redis connection
    await redisConnection.addJob('test', {}, { removeOnComplete: 1 });
    console.log('✓ Connected to Redis for queue');
    return redisConnection;
  } catch (error) {
    console.log('✗ Redis connection failed, falling back to database queue');
    return new DatabaseQueueConnection();
  }
}

export let queueConnection: QueueConnection;

export async function initializeQueue(): Promise<void> {
  queueConnection = await createQueueConnection();
}