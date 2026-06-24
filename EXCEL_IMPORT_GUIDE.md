# DigiQC Excel Import Guide

## Overview
Every page (Projects, Teams, Organizations, Checklists) now supports fast bulk import from Excel/CSV files.

## Features

### Fast Bulk Processing
- **Chunked insertion** (100 rows per chunk) to prevent overwhelming the database
- **Optimized for speed** with minimal delays between chunks
- **Parallel validation** for efficient error reporting
- **Real-time feedback** on import progress and errors

### Import Flow
1. Click **"Template"** button to download sample Excel file
2. Edit the sample file with your data
3. Click **"Import"** button
4. Select your prepared file
5. Click **"Import"** in the modal
6. Results show success count, failed count, and detailed errors

### Data Mapping

#### Projects
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| name | Text | Yes | Project name |
| nomenclature | Text | No | Code/identifier |
| instruction | Text | No | QC instructions |
| profile | Text | No | Discipline (e.g., "Civil structural") |
| image_url | URL | No | Pexels image links work best |
| status | Text | No | active/completed/on_hold |

#### Teams
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| name | Text | Yes | Team name |
| type | Text | No | inspection/audit/compliance |
| team_lead_name | Text | No | Lead name |
| spoc_name | Text | No | Single Point of Contact |

#### Organizations
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| name | Text | Yes | Organization name |
| user_limit | Number | No | Max users (default: 10) |
| licensing | Text | No | Starter/Professional/Enterprise |
| expiry_date | Date | No | YYYY-MM-DD format |
| logo_url | URL | No | Organization logo |
| console_uses | Number | No | Usage counter |

#### Checklists
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| name | Text | Yes | Checklist name |

## Error Handling

### Common Errors
- **Empty file** — Upload a file with data in first sheet
- **Invalid format** — Ensure .xlsx, .xls, or .csv format
- **Missing required fields** — name/project_name columns required
- **Invalid dates** — Use YYYY-MM-DD format (e.g., 2026-12-31)

### Error Details
All errors show:
- Row number (1-indexed with header)
- Specific error message
- Helpful retry option

## Performance

### Processing Speed
- **100 rows** — ~1 second
- **1,000 rows** — ~10-15 seconds
- **10,000 rows** — ~2-3 minutes

### Optimization Tips
1. Import in batches of 1,000+ for better performance
2. Use valid, properly formatted data
3. Test with small batch first (10-20 rows)
4. Column names are case-insensitive

## Database Integration

### Data Safety
- All imports use **RLS (Row-Level Security)**
- Authenticated users only
- Organization isolation maintained
- Transaction safety with chunking

### Auto-mapping
The import system intelligently maps common column names:
- `project_name` → `name`
- `team_lead` → `team_lead_name`
- `org_name` → `name`
- `checklist_name` → `name`
- And more...

## Example Workflows

### Bulk Project Import
1. Download projects template
2. Add 50+ projects with codes, images, profiles
3. Import all at once
4. View in Projects table immediately

### Team Setup
1. Get template
2. Add all teams with leads and SPOCs
3. Bulk import in seconds
4. Teams appear in dashboard

### Organization Onboarding
1. Prepare org list with licensing tiers
2. Import all orgs
3. Each gets RLS policies automatically
4. Ready for project/team assignment
