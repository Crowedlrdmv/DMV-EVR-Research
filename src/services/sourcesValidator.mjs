import { URL } from 'url';

const officialDomains = new Set([
  '.gov',
  '.mil', 
  '.us'
]);

const stateSubdomains = new Set([
  'dmv.ca.gov',
  'dmv.ny.gov',
  'dmv.texas.gov',
  'dmv.florida.gov',
  // Add more state-specific domains as needed
]);

export function isOfficial(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Check for official TLDs
    for (const domain of officialDomains) {
      if (hostname.endsWith(domain)) return true;
    }
    
    // Check for known state subdomains
    for (const subdomain of stateSubdomains) {
      if (hostname === subdomain || hostname.endsWith('.' + subdomain)) return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

export const fieldKeys = new Set([
  'state',
  'evr_exists',
  'evr_source_url',
  'evr_mandatory_for_dealers',
  'evr_requirement_source_url',
  'digital_forms_allowed',
  'digital_forms_source_url',
  'ownership_transfer_process',
  'ownership_transfer_source_url',
  'typical_title_issuance_time',
  'title_issuance_source_url',
  'dealer_may_issue_temp_tag',
  'temp_tag_issuance_source_url',
  'temp_tag_issuance_method',
  'temp_tag_issuance_method_source_url',
  'temp_tag_duration_days',
  'temp_tag_duration_source_url',
  'temp_tag_renewable',
  'temp_tag_renewal_source_url',
  'temp_tag_fee_who_pays',
  'temp_tag_fee_source_url'
]);

export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Payload must be an object' };
  }
  
  // Check all required fields are present
  for (const key of fieldKeys) {
    if (!(key in payload)) {
      return { ok: false, error: `Missing required field: ${key}` };
    }
  }
  
  // Validate types
  const stringFields = Array.from(fieldKeys).filter(key => key !== 'temp_tag_duration_days');
  const intFields = ['temp_tag_duration_days'];
  
  for (const field of stringFields) {
    if (payload[field] !== null && typeof payload[field] !== 'string') {
      return { ok: false, error: `Field ${field} must be a string or null` };
    }
  }
  
  for (const field of intFields) {
    if (payload[field] !== null && !Number.isInteger(payload[field])) {
      return { ok: false, error: `Field ${field} must be an integer or null` };
    }
  }
  
  // Validate all URL fields are official sources
  const urlFields = Array.from(fieldKeys).filter(key => key.endsWith('_url'));
  
  for (const field of urlFields) {
    const url = payload[field];
    if (url && !isOfficial(url)) {
      return { ok: false, error: `Field ${field} must be from an official source (.gov, .mil, .us)` };
    }
  }
  
  return { ok: true };
}