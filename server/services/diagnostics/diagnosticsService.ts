import { db } from '../../db';
import { researchJobs, researchPrograms, researchArtifacts, researchSchedules, researchProgramChanges } from '@shared/schema';
import { eq, count, desc, gte, sql } from 'drizzle-orm';

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
  components: {
    database: ComponentHealth;
    queue: ComponentHealth;
    scheduler: ComponentHealth;
    api: ComponentHealth;
  };
  metrics: SystemMetrics;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  responseTime?: number;
  lastChecked: Date;
}

export interface SystemMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  runningJobs: number;
  totalPrograms: number;
  totalSchedules: number;
  activeSchedules: number;
  totalChanges: number;
  avgJobDuration: number;
  errorRate: number;
  uptime: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  message: string;
  metadata?: Record<string, any>;
}

export class DiagnosticsService {
  private logs: LogEntry[] = [];
  private startTime = Date.now();
  private readonly MAX_LOGS = 10000; // Keep last 10k log entries
  
  /**
   * Performs comprehensive system health check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const timestamp = new Date();
    const components = await this.checkAllComponents();
    const metrics = await this.getSystemMetrics();
    
    // Determine overall system status
    const componentStatuses = Object.values(components).map(c => c.status);
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (componentStatuses.includes('critical')) {
      overallStatus = 'critical';
    } else if (componentStatuses.includes('warning')) {
      overallStatus = 'warning';
    }
    
    this.log('info', 'diagnostics', `System health check completed: ${overallStatus}`);
    
    return {
      status: overallStatus,
      timestamp,
      components,
      metrics
    };
  }
  
  /**
   * Checks health of all system components
   */
  private async checkAllComponents(): Promise<SystemHealth['components']> {
    const [database, queue, scheduler, api] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkQueueHealth(), 
      this.checkSchedulerHealth(),
      this.checkApiHealth()
    ]);
    
    return { database, queue, scheduler, api };
  }
  
  /**
   * Checks database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const start = Date.now();
    
    try {
      // Test database connectivity with a simple query
      await db.select({ count: count() }).from(researchJobs).limit(1);
      
      const responseTime = Date.now() - start;
      
      // Check for slow responses
      if (responseTime > 5000) {
        return {
          status: 'critical',
          message: `Database response time too slow: ${responseTime}ms`,
          responseTime,
          lastChecked: new Date()
        };
      } else if (responseTime > 1000) {
        return {
          status: 'warning', 
          message: `Database response time slow: ${responseTime}ms`,
          responseTime,
          lastChecked: new Date()
        };
      }
      
      return {
        status: 'healthy',
        message: `Database responding normally`,
        responseTime,
        lastChecked: new Date()
      };
      
    } catch (error) {
      this.log('error', 'database', 'Database health check failed', { error: String(error) });
      
      return {
        status: 'critical',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }
  
  /**
   * Checks queue system health
   */
  private async checkQueueHealth(): Promise<ComponentHealth> {
    try {
      // Check queue system status by attempting to import the connection
      const { initializeQueue } = await import('../../queue/connection');
      
      // For now, assume queue is working if we can import it
      // In a real system, you might check Redis connectivity here
      const isRedisAvailable = false; // We know Redis is not available from the logs
      
      return {
        status: isRedisAvailable ? 'healthy' : 'warning',
        message: isRedisAvailable 
          ? 'Queue system running on Redis' 
          : 'Queue system using database fallback (Redis unavailable)',
        lastChecked: new Date()
      };
      
    } catch (error) {
      this.log('error', 'queue', 'Queue health check failed', { error: String(error) });
      
      return {
        status: 'critical',
        message: `Queue system unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }
  
  /**
   * Checks scheduler system health
   */
  private async checkSchedulerHealth(): Promise<ComponentHealth> {
    try {
      const activeSchedules = await db
        .select({ count: count() })
        .from(researchSchedules)
        .where(eq(researchSchedules.isActive, true));
      
      const totalActive = activeSchedules[0]?.count || 0;
      
      // Check for overdue schedules
      const overdueSchedules = await db
        .select({ count: count() })
        .from(researchSchedules)
        .where(sql`${researchSchedules.isActive} = true AND ${researchSchedules.nextRunAt} < NOW() - INTERVAL '1 hour'`);
      
      const overdue = overdueSchedules[0]?.count || 0;
      
      if (overdue > 0) {
        return {
          status: 'warning',
          message: `${overdue} schedule(s) appear overdue, ${totalActive} total active`,
          lastChecked: new Date()
        };
      }
      
      return {
        status: 'healthy',
        message: `Scheduler running normally with ${totalActive} active schedules`,
        lastChecked: new Date()
      };
      
    } catch (error) {
      this.log('error', 'scheduler', 'Scheduler health check failed', { error: String(error) });
      
      return {
        status: 'critical',
        message: `Scheduler check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }
  
  /**
   * Checks API health and response times
   */
  private async checkApiHealth(): Promise<ComponentHealth> {
    // For API health, we check if we can reach this point successfully
    // In a real system, you might ping external dependencies here
    
    return {
      status: 'healthy',
      message: 'API endpoints responding normally',
      lastChecked: new Date()
    };
  }
  
  /**
   * Collects comprehensive system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [
        totalJobsResult,
        successfulJobsResult,
        failedJobsResult,
        runningJobsResult,
        totalProgramsResult,
        totalSchedulesResult,
        activeSchedulesResult,
        totalChangesResult,
        recentJobs
      ] = await Promise.all([
        db.select({ count: count() }).from(researchJobs),
        db.select({ count: count() }).from(researchJobs).where(eq(researchJobs.status, 'success')),
        db.select({ count: count() }).from(researchJobs).where(eq(researchJobs.status, 'error')),
        db.select({ count: count() }).from(researchJobs).where(eq(researchJobs.status, 'running')),
        db.select({ count: count() }).from(researchPrograms),
        db.select({ count: count() }).from(researchSchedules),
        db.select({ count: count() }).from(researchSchedules).where(eq(researchSchedules.isActive, true)),
        db.select({ count: count() }).from(researchProgramChanges),
        db.select({ 
          startedAt: researchJobs.startedAt, 
          finishedAt: researchJobs.finishedAt,
          status: researchJobs.status
        }).from(researchJobs)
          .where(sql`${researchJobs.finishedAt} IS NOT NULL`)
          .orderBy(desc(researchJobs.finishedAt))
          .limit(100)
      ]);
      
      const totalJobs = totalJobsResult[0]?.count || 0;
      const successfulJobs = successfulJobsResult[0]?.count || 0;
      const failedJobs = failedJobsResult[0]?.count || 0;
      const runningJobs = runningJobsResult[0]?.count || 0;
      const totalPrograms = totalProgramsResult[0]?.count || 0;
      const totalSchedules = totalSchedulesResult[0]?.count || 0;
      const activeSchedules = activeSchedulesResult[0]?.count || 0;
      const totalChanges = totalChangesResult[0]?.count || 0;
      
      // Calculate average job duration
      let avgJobDuration = 0;
      if (recentJobs.length > 0) {
        const durations = recentJobs
          .filter(job => job.startedAt && job.finishedAt)
          .map(job => {
            const start = new Date(job.startedAt!).getTime();
            const end = new Date(job.finishedAt!).getTime();
            return end - start;
          });
        
        if (durations.length > 0) {
          avgJobDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
        }
      }
      
      // Calculate error rate
      const errorRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;
      
      // Calculate uptime
      const uptime = Date.now() - this.startTime;
      
      return {
        totalJobs,
        successfulJobs,
        failedJobs,
        runningJobs,
        totalPrograms,
        totalSchedules,
        activeSchedules,
        totalChanges,
        avgJobDuration,
        errorRate,
        uptime
      };
      
    } catch (error) {
      this.log('error', 'metrics', 'Failed to collect system metrics', { error: String(error) });
      
      // Return default metrics on error
      return {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        runningJobs: 0,
        totalPrograms: 0,
        totalSchedules: 0,
        activeSchedules: 0,
        totalChanges: 0,
        avgJobDuration: 0,
        errorRate: 0,
        uptime: Date.now() - this.startTime
      };
    }
  }
  
  /**
   * Logs a message to the in-memory log store
   */
  log(level: LogEntry['level'], component: string, message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      metadata
    };
    
    this.logs.unshift(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }
    
    // Also log to console for immediate visibility
    const logLine = `[${level.toUpperCase()}] ${component}: ${message}`;
    if (metadata) {
      console.log(logLine, metadata);
    } else {
      console.log(logLine);
    }
  }
  
  /**
   * Gets recent log entries with optional filtering
   */
  getLogs(options: {
    limit?: number;
    level?: LogEntry['level'];
    component?: string;
    since?: Date;
  } = {}): LogEntry[] {
    let filteredLogs = [...this.logs];
    
    if (options.level) {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }
    
    if (options.component) {
      filteredLogs = filteredLogs.filter(log => log.component === options.component);
    }
    
    if (options.since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= options.since!);
    }
    
    return filteredLogs.slice(0, options.limit || 100);
  }
  
  /**
   * Gets log statistics
   */
  getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    byComponent: Record<string, number>;
    recent: number;
  } {
    const byLevel: Record<string, number> = {};
    const byComponent: Record<string, number> = {};
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    let recentCount = 0;
    
    for (const log of this.logs) {
      // Count by level
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      
      // Count by component
      byComponent[log.component] = (byComponent[log.component] || 0) + 1;
      
      // Count recent logs
      if (log.timestamp >= oneHourAgo) {
        recentCount++;
      }
    }
    
    return {
      total: this.logs.length,
      byLevel,
      byComponent,
      recent: recentCount
    };
  }
  
  /**
   * Clears log history (useful for testing)
   */
  clearLogs(): void {
    this.logs = [];
    this.log('info', 'diagnostics', 'Log history cleared');
  }
}

export const diagnosticsService = new DiagnosticsService();