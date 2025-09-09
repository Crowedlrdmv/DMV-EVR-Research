import { db } from '../db';
import { fetchArtifacts, programs, insertFetchArtifactSchema, insertProgramSchema } from '@shared/schema';
import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface ResearchJobData {
  state: string;
  dataTypes: string[];
  depth?: 'summary' | 'full';
  since?: string;
}

interface DMVSiteConfig {
  baseUrl: string;
  paths: {
    rules?: string;
    emissions?: string;
    inspections?: string;
    bulletins?: string;
    forms?: string;
  };
}

// Real DMV website configurations for each state
const DMV_SITES: Record<string, DMVSiteConfig> = {
  'CA': {
    baseUrl: 'https://www.dmv.ca.gov',
    paths: {
      rules: '/portal/vehicle-registration/new-registration/',
      emissions: '/portal/vehicle-registration/smog-check/',
      inspections: '/portal/vehicle-registration/vehicle-inspection/',
      bulletins: '/portal/news-and-media/dmv-newsroom/',
      forms: '/portal/forms-and-publications/'
    }
  },
  'TX': {
    baseUrl: 'https://www.txdmv.gov',
    paths: {
      rules: '/motorists/register-your-vehicle',
      emissions: '/motorists/emissions-testing',
      inspections: '/motorists/vehicle-inspection',
      bulletins: '/news',
      forms: '/forms'
    }
  },
  'WA': {
    baseUrl: 'https://www.dol.wa.gov',
    paths: {
      rules: '/vehicleregistration/register.html',
      emissions: '/vehicleregistration/emissions.html',
      inspections: '/vehicleregistration/inspection.html',
      bulletins: '/news/',
      forms: '/forms/'
    }
  },
  'NY': {
    baseUrl: 'https://dmv.ny.gov',
    paths: {
      rules: '/registration/register-vehicle',
      emissions: '/registration/emissions-testing',
      inspections: '/registration/inspection',
      bulletins: '/news-room',
      forms: '/forms'
    }
  },
  'FL': {
    baseUrl: 'https://www.flhsmv.gov',
    paths: {
      rules: '/motor-vehicles-tags-titles/',
      emissions: '/motor-vehicles-tags-titles/emissions/',
      inspections: '/motor-vehicles-tags-titles/vehicle-inspection/',
      bulletins: '/news/',
      forms: '/forms/'
    }
  }
};

export async function processResearchJob(jobId: string, data: ResearchJobData): Promise<void> {
  console.log(`Processing research job ${jobId} for state ${data.state}`);
  
  try {
    // Ensure artifacts directory exists
    const artifactsDir = join(process.cwd(), 'data', 'artifacts');
    await mkdir(artifactsDir, { recursive: true });

    const siteConfig = DMV_SITES[data.state];
    if (!siteConfig) {
      throw new Error(`No DMV site configuration found for state: ${data.state}`);
    }

    const programsCreated: string[] = [];

    // Process each data type
    for (const dataType of data.dataTypes) {
      const typedDataType = dataType as keyof typeof siteConfig.paths;
      const path = siteConfig.paths[typedDataType];
      
      if (!path) {
        console.warn(`No path configured for ${dataType} in state ${data.state}`);
        continue;
      }

      const url = `${siteConfig.baseUrl}${path}`;
      console.log(`Scraping ${url} for ${dataType} data...`);

      try {
        // Fetch the page with timeout and proper headers
        const response = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        });

        const htmlContent = response.data;
        const contentHash = createHash('sha256').update(htmlContent).digest('hex');
        const filename = `${data.state}_${dataType}_${Date.now()}.html`;
        const filePath = join(artifactsDir, filename);
        
        // Store artifact file
        await writeFile(filePath, htmlContent, 'utf-8');
        
        // Create fetch artifact record
        const artifactData = insertFetchArtifactSchema.parse({
          jobId,
          sourceId: `${data.state}-${dataType}`,
          url,
          hash: contentHash,
          contentType: response.headers['content-type'] || 'text/html',
          filePath: `data/artifacts/${filename}`,
          metaJson: {
            source: 'dmv-website',
            dataType,
            state: data.state,
            fetchedAt: new Date().toISOString(),
            httpStatus: response.status,
            responseHeaders: response.headers
          }
        });

        const [artifact] = await db.insert(fetchArtifacts).values(artifactData).returning();

        // Parse the HTML content to extract program information
        const $ = cheerio.load(htmlContent);
        
        // Extract meaningful data from the page
        const pageTitle = $('title').text().trim() || `${data.state} ${dataType} Program`;
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        
        // Try to extract main content text
        let summary = metaDescription;
        if (!summary) {
          // Try to find main content areas
          const contentSelectors = [
            'main p',
            '.content p',
            '.main-content p',
            'article p',
            '.page-content p',
            'p'
          ];
          
          for (const selector of contentSelectors) {
            const paragraphs = $(selector);
            if (paragraphs.length > 0) {
              summary = paragraphs.first().text().trim();
              if (summary && summary.length > 50) {
                break;
              }
            }
          }
        }

        // Fallback summary if nothing found
        if (!summary || summary.length < 20) {
          summary = `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} compliance program for ${data.state}. Visit the official DMV website for detailed requirements and procedures.`;
        }

        // Limit summary length
        if (summary.length > 500) {
          summary = summary.substring(0, 497) + '...';
        }

        // Create normalized program from real scraped content
        const programData = insertProgramSchema.parse({
          jobId, // Link program to the research job
          state: data.state,
          type: dataType as any,
          title: pageTitle,
          url,
          effectiveDate: new Date(), // Set to current date since we don't have historical info
          lastUpdated: new Date(),
          summary,
          rawSourceId: artifact.id,
          // Source validation fields - real data, not demo
          sourceValid: true,
          httpStatus: response.status,
          checkedAt: new Date(),
          isDemo: false // This is real data now!
        });

        await db.insert(programs).values(programData);
        programsCreated.push(dataType);
        
        console.log(`✓ Successfully scraped and stored ${dataType} program for ${data.state}`);
        
        // Add a small delay between requests to be respectful to the servers
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to scrape ${dataType} for ${data.state}:`, error);
        
        // Create a record for the failed attempt with error details
        try {
          const errorArtifactData = insertFetchArtifactSchema.parse({
            jobId,
            sourceId: `${data.state}-${dataType}-error`,
            url,
            hash: createHash('sha256').update(`error-${Date.now()}`).digest('hex'),
            contentType: 'text/plain',
            filePath: null,
            metaJson: {
              source: 'dmv-website',
              dataType,
              state: data.state,
              fetchedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error',
              httpStatus: axios.isAxiosError(error) ? error.response?.status : null
            }
          });

          const [errorArtifact] = await db.insert(fetchArtifacts).values(errorArtifactData).returning();

          // Create a program record indicating the failure
          const errorProgramData = insertProgramSchema.parse({
            jobId,
            state: data.state,
            type: dataType as any,
            title: `${data.state} ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Program (Source Unavailable)`,
            url,
            effectiveDate: new Date(),
            lastUpdated: new Date(),
            summary: `Unable to retrieve current ${dataType} program information from the official ${data.state} DMV website. Please check the source directly for up-to-date requirements.`,
            rawSourceId: errorArtifact.id,
            sourceValid: false,
            sourceReason: error instanceof Error ? error.message : 'Failed to fetch',
            httpStatus: axios.isAxiosError(error) ? error.response?.status || 0 : 0,
            checkedAt: new Date(),
            isDemo: false
          });

          await db.insert(programs).values(errorProgramData);
          console.log(`⚠ Created error record for ${dataType} in ${data.state}`);
        } catch (recordError) {
          console.error(`Failed to create error record for ${dataType} in ${data.state}:`, recordError);
        }
      }
    }

    const successCount = programsCreated.length;
    const totalRequested = data.dataTypes.length;
    
    console.log(`✓ Completed research job ${jobId} - successfully created ${successCount}/${totalRequested} programs for ${data.state}`);
    
  } catch (error) {
    console.error(`✗ Research job ${jobId} failed:`, error);
    throw error;
  }
}