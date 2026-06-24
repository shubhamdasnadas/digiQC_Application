# DigiQC Setup & Database Connection Guide

## Quick Start (3 Steps)

### Step 1: Environment Configuration
Your `.env` file is already pre-configured with Supabase credentials:

```env
VITE_SUPABASE_URL=https://brqlnvfphyeggycsrvag.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJycWxudmZwaHllZ2d5Y3NydmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTUzNTgsImV4cCI6MjA5NjEzMTM1OH0.k4rzt7KOa7KxlxzNEERLkbSeMJBKazdK5S6uy0P7iok
```

**These variables are automatically loaded by Vite during build.**

### Step 2: Install Dependencies
```bash
npm install
```

This installs all required packages including:
- React & React-DOM
- Supabase JS client
- XLSX for Excel import
- Lucide React for icons
- Tailwind CSS

### Step 3: Run Development Server
```bash
npm run dev
```

The application will:
1. Connect to Supabase using the .env credentials
2. Load all dummy data (100+ projects, teams, checklists)
3. Display on http://localhost:5173

---

## Database Connection Details

### Supabase Project Information

| Field | Value |
|-------|-------|
| **Project Name** | DigiQC |
| **Database** | PostgreSQL |
| **Region** | Auto-managed by Supabase |
| **URL** | `https://brqlnvfphyeggycsrvag.supabase.co` |
| **Anon Key** | Configured in .env |

### How Connection Works

#### 1. Environment Variables (`src/lib/supabase.ts`)
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

#### 2. Client Initialization
- Vite automatically loads `.env` variables with `VITE_` prefix
- Client created at app startup
- All queries use this authenticated connection

#### 3. Data Flow
```
User Action → React Component → Supabase JS Client → PostgreSQL
                                    ↓
                            (RLS Policies)
                                    ↓
                            Data returned to UI
```

---

## Project Structure

```
project/
├── .env                          # Supabase credentials (DO NOT COMMIT)
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Client initialization
│   │   ├── types.ts             # Database types
│   │   ├── excelImport.ts       # Excel processing
│   │   └── excelTemplate.ts     # Template generation
│   ├── components/
│   │   ├── Header.tsx           # Top navigation
│   │   ├── Sidebar.tsx          # Left navigation
│   │   └── ImportModal.tsx      # Excel import UI
│   ├── context/
│   │   └── ThemeContext.tsx     # Dark/light mode
│   ├── pages/
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── Projects.tsx         # Projects management
│   │   ├── Teams.tsx            # Teams management
│   │   ├── Organizations.tsx    # Organizations
│   │   ├── Checklists.tsx       # Checklists
│   │   └── Setup.tsx            # Setup guide
│   └── App.tsx                  # Root component
└── package.json                 # Dependencies
```

---

## Database Schema

### Tables Created

#### organizations
- Organizations/Tenants using the platform
- Fields: name, user_limit, licensing, expiry_date, logo_url, console_uses

#### super_admins
- Admin users for each organization
- Fields: organization_id, name, email, mobile_no, roles

#### teams
- Teams within organizations
- Fields: organization_id, name, type, team_lead_name, spoc_name

#### projects
- Quality control projects
- Fields: organization_id, name, nomenclature, instruction, profile, **image_url**, status

#### checklists
- Checklists linked to projects
- Fields: project_id, name

#### checklist_stages
- 2D stages within checklists
- Fields: checklist_id, sr_no, name

#### checkpoints
- Individual checkpoint questions
- Fields: stage_id, question, input_type, drawing_required, witness_required

### Row-Level Security (RLS)

All tables have RLS enabled:
- Authenticated users can read their organization's data
- Authenticated users can insert/update their organization's data
- Policies prevent cross-organization data leakage

---

## Dummy Data Overview

### What's Included

**8 Organizations:**
- City Hospital, Green Ross Infrastructure, Lakeside Construction
- Meridian Tech Park, Sunrise Hospitals Ltd, Coastal Resorts Group
- TechBuild Systems, SafeConstruct Ltd, UrbanDev Analytics, Infrastructure Pro, Quality First QC

**18+ Teams:**
- 2-6 teams per organization
- Types: inspection, audit, compliance
- Each with team lead and SPOC names

**100+ Projects:**
- 15 unique project types (Foundation, Electrical, Plumbing, HVAC, etc.)
- Each with unique nomenclature codes (FRCC-001, ELEC-002, etc.)
- Real construction project profiles
- Pexels image URLs for visual reference
- Status: active, in_progress, completed, on_hold

**400+ Checklists:**
- 4 checklists per project
- Names: Pre-Construction Audit, Mid-Stage Inspection, Pre-Handover QC, Final Certification

**2,400+ Checklist Stages:**
- 6 stages per checklist
- Sequential stages from documentation to handover

**19,200+ Checkpoints:**
- 8 checkpoint questions per stage
- Input types: yes_no, numeric, text
- Drawing requirements and witness requirements configured

---

## How to Use

### 1. View Data
- **Dashboard** — Overview of all data
- **Projects** — All projects with table view and import
- **Teams** — Team management
- **Organizations** — Organization management
- **Checklists** — Checklist overview
- **Setup** — Connection details and guides

### 2. Import Excel Data

#### Download Template
1. Go to any page (Projects, Teams, Organizations, Checklists)
2. Click **"Template"** button
3. Save the Excel file

#### Prepare Data
1. Open template in Excel/Sheets
2. Add your data (keeping column headers)
3. Save as `.xlsx` or `.csv`

#### Import Data
1. Click **"Import"** button on the page
2. Select your prepared file
3. Review file info and click **"Import"**
4. Watch progress and error messages
5. Success! Data appears in table

### 3. Add Data Manually
- Click **"Add [Item]"** button on any page
- Fill form fields
- Click save

### 4. Search & Filter
- Use search boxes to filter by name
- Use status filters to see active/completed/on_hold
- Tables show sorted, paginated results

---

## Environment Variables Explained

### VITE_SUPABASE_URL
```env
VITE_SUPABASE_URL=https://brqlnvfphyeggycsrvag.supabase.co
```
- **Purpose:** API endpoint for all database requests
- **Used by:** `src/lib/supabase.ts`
- **Access:** Available as `import.meta.env.VITE_SUPABASE_URL` in code

### VITE_SUPABASE_ANON_KEY
```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- **Purpose:** JWT token for client-side authentication
- **Used by:** Supabase JS client for request authorization
- **Access:** Available as `import.meta.env.VITE_SUPABASE_ANON_KEY` in code

**Note:** Only keys prefixed with `VITE_` are exposed to frontend code.

---

## Connecting Your Own Database

### If Using Supabase (Recommended)

1. Create project at https://supabase.com
2. Go to **Project Settings > API**
3. Copy **Project URL** and **anon public key**
4. Update `.env`:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
5. Run migrations from `supabase/migrations/` folder:
   ```bash
   # Supabase CLI (if installed)
   supabase db push
   ```
6. Or manually run SQL from migration files in Supabase dashboard

### If Using Other PostgreSQL Database

The application uses Supabase-specific features:
- Auth integration
- RLS policies
- PostgREST API

You would need to:
1. Replace Supabase client with standard PostgreSQL driver
2. Implement your own authentication
3. Set up RLS policies manually
4. Configure CORS for PostgREST API

For simplicity, **Supabase is recommended**.

---

## Key Features & How They Work

### 1. Dark Mode / Light Mode
- **Location:** Top-right sun/moon icon in Header
- **Storage:** localStorage (persists on refresh)
- **Code:** `src/context/ThemeContext.tsx`

### 2. Excel Import with Bulk Processing
- **Speed:** 100 rows per batch, 50ms delay between
- **Process:**
  1. Parse Excel/CSV using XLSX library
  2. Validate data
  3. Split into 100-row chunks
  4. Insert chunks sequentially
  5. Return error report
- **Time:** ~10-15 seconds for 1,000 rows

### 3. Data Tables
- **Collapsible:** Click "Show Table" to expand
- **Searchable:** Filter using search boxes
- **Sortable:** Click headers to sort (integrated in table)
- **Responsive:** Works on mobile and desktop

### 4. Status Badges
- **Active** — Green, currently in progress
- **Completed** — Blue, finished
- **On Hold** — Amber, paused

---

## Troubleshooting

### Connection Issues

**Problem:** "Failed to connect to database"

**Solution:**
1. Check internet connection
2. Verify `.env` file has correct URLs and keys
3. Check Supabase project status in dashboard
4. Restart dev server: `npm run dev`

### Import Fails

**Problem:** "Import failed" or "Invalid format"

**Solution:**
1. Ensure file is `.xlsx`, `.xls`, or `.csv`
2. Download template first
3. Use template structure (same column names)
4. Ensure data matches column types
5. Test with small batch (5-10 rows) first

### Data Not Showing

**Problem:** Tables are empty

**Solution:**
1. Check browser console for errors
2. Verify RLS policies are correct
3. Ensure you're authenticated
4. Try refreshing page
5. Clear browser cache: `Ctrl+Shift+Delete`

### Slow Performance

**Problem:** Import or data loading is slow

**Solution:**
1. Import in smaller batches (100-500 rows)
2. Close other browser tabs
3. Check internet connection
4. Check Supabase dashboard for database load
5. Consider using a wired connection

---

## Security Notes

### Environment Variables
- ✅ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are exposed to client (intentional)
- ❌ Never expose SUPABASE_SERVICE_ROLE_KEY in frontend
- ❌ Never commit `.env` file to version control
- ✅ Add `.env` to `.gitignore`

### Row-Level Security
- All data access is controlled by RLS policies
- Users can only see their organization's data
- Admin users have elevated permissions
- Audit trail available in Supabase dashboard

### Data Privacy
- All data encrypted in transit (HTTPS)
- Data encrypted at rest in Supabase
- Regular backups automated by Supabase
- GDPR compliant infrastructure

---

## Getting Help

### Support Resources
1. **Supabase Docs:** https://supabase.com/docs
2. **Supabase Dashboard:** https://app.supabase.com
3. **React Docs:** https://react.dev
4. **Tailwind CSS:** https://tailwindcss.com

### Common Answers

**Q: How do I add more fields to projects?**
A: Modify `src/lib/types.ts`, update database schema via migration, update forms in `Projects.tsx`

**Q: Can I export data?**
A: Yes, use Excel import system in reverse (queries data, exports to XLSX)

**Q: How do I backup data?**
A: Supabase handles automatic daily backups. Access via dashboard.

**Q: Can I use this offline?**
A: No, it requires live Supabase connection. For offline, use local SQLite instead.

---

## Production Deployment

When ready to deploy:

1. **Environment Variables**
   - Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in hosting provider

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy**
   - Push `dist/` folder to hosting (Vercel, Netlify, Cloudflare)

4. **Database**
   - Supabase handles auto-scaling
   - Set backup frequency
   - Enable monitoring

---

**Last Updated:** 2026-06-04  
**Version:** DigiQC Phase 1 v1.0
