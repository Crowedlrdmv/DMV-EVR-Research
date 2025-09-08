# DMV State Research Extension

## Overview

This extension adds comprehensive state research capabilities to the DMV Compliance Research Application, enabling tracking of 21 specific DMV regulation fields per state with official source validation and manual data entry.

## Features

- **Manual Data Entry**: Primary mode for entering state DMV research data
- **Official Source Validation**: All URLs must be from `.gov`, `.mil`, or `.us` domains
- **Comprehensive Field Tracking**: 21 specific DMV regulation fields per state
- **Excel Export**: Per-state and bulk export capabilities
- **Search Interface**: HTML interface for searching and managing states
- **Bearer Token Authentication**: Protected endpoints for data modification

## API Endpoints

### Public Endpoints (No Authentication Required)

#### List States
```bash
GET /api/states
GET /api/states?q=search_term
GET /api/states?missing=true
```

**Examples:**
```bash
curl http://localhost:5000/api/states
curl "http://localhost:5000/api/states?q=california"
curl "http://localhost:5000/api/states?missing=true"
```

#### Get State Details
```bash
GET /api/states/:code
```

**Example:**
```bash
curl http://localhost:5000/api/states/CA
```

#### Get State Sources
```bash
GET /api/states/:code/sources
```

**Example:**
```bash
curl http://localhost:5000/api/states/CA/sources
```

### Protected Endpoints (Require Bearer Token)

#### Update State Research Data
```bash
PUT /api/states/:code
```

**Example:**
```bash
curl -X PUT http://localhost:5000/api/states/CA \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "CA",
    "evr_exists": "Yes",
    "evr_source_url": "https://dmv.ca.gov/portal/vehicle-registration/electronic-vehicle-registration/",
    "evr_mandatory_for_dealers": "Yes",
    "evr_requirement_source_url": "https://dmv.ca.gov/portal/handbook/vehicle-industry-registration-procedures-manual-2/",
    "digital_forms_allowed": "Yes",
    "digital_forms_source_url": "https://dmv.ca.gov/portal/vehicle-registration/",
    "ownership_transfer_process": "Title transfer and registration must be completed within 20 days",
    "ownership_transfer_source_url": "https://dmv.ca.gov/portal/vehicle-registration/buy-sell-transfer/",
    "typical_title_issuance_time": "2-3 weeks",
    "title_issuance_source_url": "https://dmv.ca.gov/portal/vehicle-registration/titles/",
    "dealer_may_issue_temp_tag": "Yes",
    "temp_tag_issuance_source_url": "https://dmv.ca.gov/portal/vehicle-industry/licensing/dealer-licensing/",
    "temp_tag_issuance_method": "DMV dealer portal system",
    "temp_tag_issuance_method_source_url": "https://dmv.ca.gov/portal/vehicle-industry/",
    "temp_tag_duration_days": 90,
    "temp_tag_duration_source_url": "https://dmv.ca.gov/portal/vehicle-registration/temporary-operating-permits/",
    "temp_tag_renewable": "No",
    "temp_tag_renewal_source_url": "https://dmv.ca.gov/portal/vehicle-registration/temporary-operating-permits/",
    "temp_tag_fee_who_pays": "Dealer",
    "temp_tag_fee_source_url": "https://dmv.ca.gov/portal/vehicle-industry/fees/"
  }'
```

#### Assisted Research (Disabled by Default)
```bash
POST /api/states/:code/research
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/states/CA/research \
  -H "Authorization: Bearer dev-secret-token"
```

## Export Functionality

### Export All States Research
```bash
GET /api/export?type=states
```

### Export Single State Research
```bash
GET /api/export?state=CA
```

### Export Compliance Records (Default)
```bash
GET /api/export
```

**Examples:**
```bash
curl "http://localhost:5000/api/export?type=states" -o all_states.xlsx
curl "http://localhost:5000/api/export?state=CA" -o california.xlsx
curl "http://localhost:5000/api/export" -o compliance_records.xlsx
```

## Required Fields (21 Total)

All PUT requests must include all 21 fields, even if some are `null`:

1. `state` - State code (e.g., "CA")
2. `evr_exists` - Whether Electronic Vehicle Registration exists
3. `evr_source_url` - Official source URL for EVR information
4. `evr_mandatory_for_dealers` - Whether EVR is mandatory for dealers
5. `evr_requirement_source_url` - Source URL for EVR requirements
6. `digital_forms_allowed` - Whether digital forms are allowed
7. `digital_forms_source_url` - Source URL for digital forms info
8. `ownership_transfer_process` - Description of ownership transfer process
9. `ownership_transfer_source_url` - Source URL for transfer process
10. `typical_title_issuance_time` - Typical time for title issuance
11. `title_issuance_source_url` - Source URL for title issuance info
12. `dealer_may_issue_temp_tag` - Whether dealers can issue temp tags
13. `temp_tag_issuance_source_url` - Source URL for temp tag issuance
14. `temp_tag_issuance_method` - Method for issuing temp tags
15. `temp_tag_issuance_method_source_url` - Source URL for issuance method
16. `temp_tag_duration_days` - Duration of temp tags in days (integer)
17. `temp_tag_duration_source_url` - Source URL for duration info
18. `temp_tag_renewable` - Whether temp tags are renewable
19. `temp_tag_renewal_source_url` - Source URL for renewal info
20. `temp_tag_fee_who_pays` - Who pays the temp tag fee
21. `temp_tag_fee_source_url` - Source URL for fee information

## Web Interface

Access the state research interface at:
```
http://localhost:5000/states.html
```

Features:
- Search states by name or code
- Filter states with missing data
- View state details
- Export individual state data
- Export all states data

## Environment Variables

Add to your `.env` file:

```env
RESEARCH_MODE=manual
ALLOW_WEB_AUTOMATION=false
```

- `RESEARCH_MODE`: Set to `assisted` to enable automated research (requires `ALLOW_WEB_AUTOMATION=true`)
- `ALLOW_WEB_AUTOMATION`: Must be `true` to enable web automation features (currently stubbed)

## Database Schema

The extension adds three new tables:

### `states`
- `id` - Primary key (serial)
- `code` - 2-character state code (unique)
- `name` - Full state name
- `created_at`, `updated_at` - Timestamps

### `state_results`
- `state_id` - Foreign key to states table (primary key)
- All 21 research fields as columns
- `last_verified_at` - Timestamp of last verification
- `created_at`, `updated_at` - Timestamps

### `state_sources`
- `id` - Primary key (serial)
- `state_id` - Foreign key to states table
- `field_key` - Name of the field this source applies to
- `url` - The official source URL
- `note` - Optional note about the source
- `created_at`, `updated_at` - Timestamps

## Source Validation

All URL fields are validated to ensure they come from official sources:

✅ **Allowed domains:**
- `.gov` (government sites)
- `.mil` (military sites)  
- `.us` (US territory sites)

❌ **Rejected domains:**
- `.com`, `.org`, `.net` (commercial/non-official sites)
- Any other non-official domain

**Example validation:**
```bash
# This will be accepted
"evr_source_url": "https://dmv.ca.gov/portal/vehicle-registration/"

# This will be rejected
"evr_source_url": "https://somewebsite.com/dmv-info"
```

## Error Handling

The API returns appropriate HTTP status codes and JSON error messages:

### 400 Bad Request
- Missing required fields
- Invalid field types
- Non-official source URLs
- Invalid state codes

### 401 Unauthorized
- Missing or invalid bearer token (for protected endpoints)

### 404 Not Found
- State not found

### 500 Internal Server Error
- Database or server errors

## Testing

All functionality has been tested with curl commands. Run the acceptance tests:

```bash
# Test listing states
curl http://localhost:5000/api/states

# Test creating state data
curl -X PUT http://localhost:5000/api/states/CA \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{ /* full payload */ }'

# Test getting state data
curl http://localhost:5000/api/states/CA

# Test source validation (should fail)
curl -X PUT http://localhost:5000/api/states/CA \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"evr_source_url": "https://badsite.com/info", /* other fields */ }'

# Test exports
curl "http://localhost:5000/api/export?state=CA" -o ca_export.xlsx
```

## Integration

The state research functionality is fully integrated with the existing DMV Compliance Research Application:

- Uses the same authentication system
- Shares the same export infrastructure  
- Maintains the same API patterns
- Uses the existing database connection
- Follows the same error handling conventions

The extension preserves all existing functionality while adding the new state research capabilities.