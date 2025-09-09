import { db } from '../db';
import { fetchArtifacts, programs, insertFetchArtifactSchema, insertProgramSchema } from '@shared/schema';
import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface ResearchJobData {
  state: string;
  dataTypes: string[];
  depth?: 'summary' | 'full';
  since?: string;
}

export async function processResearchJob(jobId: string, data: ResearchJobData): Promise<void> {
  console.log(`Processing research job ${jobId} for state ${data.state}`);
  
  try {
    // Ensure artifacts directory exists
    const artifactsDir = join(process.cwd(), 'data', 'artifacts');
    await mkdir(artifactsDir, { recursive: true });

    // Create dummy artifact for MVP
    const dummyContent = createDummyStateContent(data.state, data.dataTypes);
    const contentHash = createHash('sha256').update(dummyContent).digest('hex');
    const filename = `${data.state}_dummy_${Date.now()}.html`;
    const filePath = join(artifactsDir, filename);
    
    // Store artifact file
    await writeFile(filePath, dummyContent, 'utf-8');
    
    // Create fetch artifact record
    const artifactData = insertFetchArtifactSchema.parse({
      jobId,
      sourceId: `dummy-${data.state}`,
      url: `https://dmv.${data.state.toLowerCase()}.gov/dummy`,
      hash: contentHash,
      contentType: 'text/html',
      filePath: `data/artifacts/${filename}`,
      metaJson: {
        source: 'dummy',
        dataTypes: data.dataTypes,
        fetchedAt: new Date().toISOString()
      }
    });

    const [artifact] = await db.insert(fetchArtifacts).values(artifactData).returning();

    // Create normalized program from dummy content
    for (const dataType of data.dataTypes) {
      const programData = insertProgramSchema.parse({
        jobId, // Link program to the research job
        state: data.state,
        type: dataType as any,
        title: `${data.state} ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Program`,
        url: `https://dmv.${data.state.toLowerCase()}.gov/${dataType}`,
        effectiveDate: new Date(),
        lastUpdated: new Date(),
        summary: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} compliance program for ${data.state}. Includes requirements for vehicle ${dataType}, fee structure, and compliance deadlines.`,
        rawSourceId: artifact.id,
        // Source validation fields - mark as demo data
        sourceValid: true,
        httpStatus: 200,
        checkedAt: new Date(),
        isDemo: true
      });

      await db.insert(programs).values(programData);
    }

    // Create a few programs with various source validation statuses for demo
    if (data.dataTypes.includes('emissions')) {
      // Add a broken link example
      const brokenLinkProgram = insertProgramSchema.parse({
        jobId, // Link program to the research job
        state: data.state,
        type: 'emissions',
        title: `${data.state} Legacy Emissions System`,
        url: `https://old.dmv.${data.state.toLowerCase()}.gov/emissions-legacy`,
        effectiveDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        lastUpdated: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago  
        summary: `Legacy emissions program with outdated source link`,
        rawSourceId: artifact.id,
        sourceValid: false,
        sourceReason: '404',
        httpStatus: 404,
        checkedAt: new Date(),
        isDemo: true
      });
      
      await db.insert(programs).values(brokenLinkProgram);
    }

    console.log(`✓ Completed research job ${jobId} - created ${data.dataTypes.length} programs`);
    
  } catch (error) {
    console.error(`✗ Research job ${jobId} failed:`, error);
    throw error;
  }
}

function createDummyStateContent(state: string, dataTypes: string[]): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>${state} DMV Programs</title>
</head>
<body>
    <h1>${state} Department of Motor Vehicles</h1>
    <div class="programs">
        ${dataTypes.map(type => `
        <section class="program-${type}">
            <h2>${type.charAt(0).toUpperCase() + type.slice(1)} Program</h2>
            <p>This is a dummy ${type} program for ${state}.</p>
            <div class="requirements">
                <h3>Requirements</h3>
                <ul>
                    <li>Valid identification document</li>
                    <li>Proof of residency in ${state}</li>
                    <li>Payment of applicable fees</li>
                </ul>
            </div>
            <div class="fees">
                <h3>Fees</h3>
                <table>
                    <tr><td>${type} fee</td><td>$25.00</td></tr>
                    <tr><td>Processing fee</td><td>$5.00</td></tr>
                </table>
            </div>
            <div class="deadlines">
                <h3>Important Deadlines</h3>
                <p>Annual renewal required by December 31st</p>
            </div>
        </section>
        `).join('')}
    </div>
    <footer>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>State: ${state}</p>
    </footer>
</body>
</html>
  `.trim();
}