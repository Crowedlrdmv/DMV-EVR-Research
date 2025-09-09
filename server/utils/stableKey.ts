import { createHash } from 'crypto';

/**
 * Generates a deterministic stable_key for research programs
 * Used for deduplication across different research runs
 */
export function generateStableKey(data: {
  state: string;
  type: string;
  title: string;
  sourceUrl?: string;
}): string {
  // Normalize state code to uppercase
  const normalizedState = data.state.toUpperCase().trim();
  
  // Normalize program type to lowercase
  const normalizedType = data.type.toLowerCase().trim();
  
  // Normalize title by removing extra whitespace, converting to lowercase
  const normalizedTitle = data.title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
    .trim();
  
  // Canonicalize URL by removing common variations
  let canonicalUrl = '';
  if (data.sourceUrl) {
    canonicalUrl = canonicalizeUrl(data.sourceUrl);
  }
  
  // Create deterministic combination
  const keyData = [
    normalizedState,
    normalizedType,
    normalizedTitle,
    canonicalUrl
  ].join('|');
  
  // Generate SHA-256 hash for stable key
  return createHash('sha256')
    .update(keyData, 'utf8')
    .digest('hex');
}

/**
 * Canonicalizes URLs for consistent deduplication
 */
function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    
    // Normalize protocol to https
    parsed.protocol = 'https:';
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'referrer'];
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    
    // Remove trailing slash unless it's the root path
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    
    // Sort search parameters for consistency
    parsed.searchParams.sort();
    
    // Remove fragment (hash)
    parsed.hash = '';
    
    return parsed.toString();
  } catch (error) {
    // If URL parsing fails, return normalized string
    return url.toLowerCase().trim();
  }
}

/**
 * Normalizes program data for consistent processing
 */
export function normalizeProgram(data: {
  state: string;
  type: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  lastUpdated?: Date;
}) {
  return {
    state: data.state.toUpperCase().trim(),
    type: data.type.toLowerCase().trim(),
    title: data.title.trim(),
    summary: data.summary?.trim() || null,
    sourceUrl: data.sourceUrl ? canonicalizeUrl(data.sourceUrl) : null,
    lastUpdated: data.lastUpdated || null,
  };
}