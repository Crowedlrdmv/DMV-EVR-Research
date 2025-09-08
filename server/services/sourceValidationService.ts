import { db } from '../db';
import { programs } from '../../shared/schema';
import { eq, and, or, isNull, lt, isNotNull, like, count } from 'drizzle-orm';

interface SourceValidationResult {
  url: string;
  status: 'valid' | 'invalid';
  httpStatus?: number;
  reason?: string;
}

interface ValidationCache {
  [url: string]: {
    result: SourceValidationResult;
    checkedAt: Date;
  };
}

class SourceValidationService {
  private cache: ValidationCache = {};
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Normalize URL for consistency
  private normalizeUrl(url: string): string | null {
    try {
      if (!url || typeof url !== 'string') return null;
      
      // Clean up the URL
      let cleanUrl = url.trim();
      
      // Add protocol if missing
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const urlObj = new URL(cleanUrl);
      
      // Normalize domain to lowercase
      urlObj.hostname = urlObj.hostname.toLowerCase();
      
      return urlObj.toString();
    } catch (error) {
      return null;
    }
  }

  // Check if URL is reachable with HEAD request, fallback to GET
  private async checkUrlReachability(url: string): Promise<SourceValidationResult> {
    const normalizedUrl = this.normalizeUrl(url);
    
    if (!normalizedUrl) {
      return {
        url,
        status: 'invalid',
        reason: 'malformed'
      };
    }

    try {
      // Check cache first
      const cacheKey = normalizedUrl;
      const cached = this.cache[cacheKey];
      if (cached && (Date.now() - cached.checkedAt.getTime()) < this.CACHE_DURATION_MS) {
        return cached.result;
      }

      // Try HEAD request first (faster)
      let response: Response;
      try {
        response = await fetch(normalizedUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'DMV-Compliance-Research-Bot/1.0',
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
      } catch (headError) {
        // Fallback to GET request if HEAD fails
        response = await fetch(normalizedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'DMV-Compliance-Research-Bot/1.0',
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
      }

      const result: SourceValidationResult = {
        url: normalizedUrl,
        status: response.ok ? 'valid' : 'invalid',
        httpStatus: response.status,
        reason: response.ok ? undefined : response.status.toString()
      };

      // Cache the result
      this.cache[cacheKey] = {
        result,
        checkedAt: new Date()
      };

      return result;
    } catch (error) {
      const result: SourceValidationResult = {
        url,
        status: 'invalid',
        httpStatus: 0,
        reason: error instanceof Error ? error.message : 'network_error'
      };

      return result;
    }
  }

  // Validate sources for programs that haven't been checked recently
  async validateProgramSources(batchSize = 10): Promise<{ validated: number; errors: string[] }> {
    const errors: string[] = [];
    let validatedCount = 0;

    try {
      // Find programs that need validation (never checked or checked > 24h ago)
      const cutoffDate = new Date(Date.now() - this.CACHE_DURATION_MS);
      
      const programsToValidate = await db
        .select()
        .from(programs)
        .where(
          and(
            or(
              isNull(programs.checkedAt),
              lt(programs.checkedAt, cutoffDate)
            ),
            // Only validate programs that have URLs
            isNotNull(programs.url)
          )
        )
        .limit(batchSize);

      for (const program of programsToValidate) {
        if (!program.url) continue;

        try {
          const validation = await this.checkUrlReachability(program.url);
          
          await db
            .update(programs)
            .set({
              sourceValid: validation.status === 'valid',
              sourceReason: validation.reason,
              httpStatus: validation.httpStatus,
              checkedAt: new Date(),
            })
            .where(eq(programs.id, program.id));

          validatedCount++;
        } catch (error) {
          const errorMsg = `Failed to validate ${program.url}: ${error instanceof Error ? error.message : 'unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return { validated: validatedCount, errors };
    } catch (error) {
      const errorMsg = `Source validation service error: ${error instanceof Error ? error.message : 'unknown error'}`;
      errors.push(errorMsg);
      return { validated: validatedCount, errors };
    }
  }

  // Mark demo data in existing programs
  async markDemoData(): Promise<{ marked: number; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // List of patterns that indicate demo/placeholder URLs
      const demoPatterns = [
        'dmv.wa.gov/enissions', // typo in emissions
        'example.com',
        'placeholder.com',
        'demo.com',
        'test.com',
        'localhost',
        '127.0.0.1',
        'fake.url',
        'dummy.url',
        'sample.url',
      ];

      let markedCount = 0;

      for (const pattern of demoPatterns) {
        const result = await db
          .update(programs)
          .set({
            isDemo: true,
            sourceValid: false,
            sourceReason: 'demo_data',
          })
          .where(
            and(
              like(programs.url, `%${pattern}%`),
              eq(programs.isDemo, false)
            )
          );
        
        // Note: result doesn't directly give us affected rows count in all cases
        // This is an approximation for logging purposes
        markedCount += 1;
      }

      return { marked: markedCount, errors };
    } catch (error) {
      const errorMsg = `Failed to mark demo data: ${error instanceof Error ? error.message : 'unknown error'}`;
      errors.push(errorMsg);
      return { marked: 0, errors };
    }
  }

  // Get validation statistics
  async getValidationStats(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    unchecked: number;
    demo: number;
  }> {
    try {
      const [totalResult] = await db
        .select({ count: count() })
        .from(programs)
        .where(isNotNull(programs.url));

      const [validResult] = await db
        .select({ count: count() })
        .from(programs)
        .where(
          and(
            eq(programs.sourceValid, true),
            eq(programs.isDemo, false)
          )
        );

      const [invalidResult] = await db
        .select({ count: count() })
        .from(programs)
        .where(
          and(
            eq(programs.sourceValid, false),
            eq(programs.isDemo, false)
          )
        );

      const [uncheckedResult] = await db
        .select({ count: count() })
        .from(programs)
        .where(
          and(
            isNull(programs.checkedAt),
            eq(programs.isDemo, false)
          )
        );

      const [demoResult] = await db
        .select({ count: count() })
        .from(programs)
        .where(eq(programs.isDemo, true));

      return {
        total: totalResult?.count || 0,
        valid: validResult?.count || 0,
        invalid: invalidResult?.count || 0,
        unchecked: uncheckedResult?.count || 0,
        demo: demoResult?.count || 0,
      };
    } catch (error) {
      console.error('Failed to get validation stats:', error);
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        unchecked: 0,
        demo: 0,
      };
    }
  }
}

export const sourceValidationService = new SourceValidationService();