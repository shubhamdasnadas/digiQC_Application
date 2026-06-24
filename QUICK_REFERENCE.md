# DigiQC Quick Reference

## 🚀 Start Here (3 Commands)
```bash
npm install          # Install once
npm run dev         # Run dev server
# Open http://localhost:5173
```

## 📂 Files You Should Know

### Configuration
- `.env` — Supabase credentials (pre-configured)
- `.env.example` — Template for your own database
- `tailwind.config.js` — Color & design customization
- `package.json` — Dependencies & scripts

### Documentation
- `README.md` — Overview & quick start
- `SETUP_GUIDE.md` — Detailed database setup
- `ENV_SETUP.md` — Environment variables explained
- `EXCEL_IMPORT_GUIDE.md` — How to import data
- `DEPLOYMENT_SUMMARY.md` — Complete summary

### Key Code Files
- `src/lib/supabase.ts` — Database client
- `src/lib/excelImport.ts` — Import processing
- `src/App.tsx` — Root component
- `src/pages/Dashboard.tsx` — Main dashboard

## 🎯 Common Tasks

### View Data
→ Go to any page (Projects, Teams, etc.)
→ Scroll to table section
→ Click "Show Table" to expand

### Import Excel
→ Click "Template" button
→ Edit Excel file with your data
→ Click "Import" button
→ Select file and upload

### Change Theme
→ Click sun/moon icon in top-right header
→ Theme persists automatically

### Add New Data
→ Click "Add [Item]" button on any page
→ Fill form and save

### Search Data
→ Use search box to filter by name
→ Use status buttons to filter by status
→ Results update in real-time

## 🔧 Commands

```bash
npm install                 # Install dependencies (first time only)
npm run dev                 # Start dev server (http://localhost:5173)
npm run build              # Build for production (creates dist/)
npm run preview            # Preview production build
npm run lint               # Run ESLint checks
npm run typecheck          # Check TypeScript errors
```

## 📊 Database Info

**Tables:** 7  
**Records:** 22,000+  
**Organizations:** 8+  
**Projects:** 120+  
**Teams:** 50+  
**Checklists:** 400+  
**Stages:** 2,400+  
**Checkpoints:** 19,200+  

## 🌍 Pages

| Page | Purpose | Features |
|------|---------|----------|
| Dashboard | Overview | Stats + 7 tables |
| Projects | Manage projects | Import + search |
| Teams | Team management | Add/edit teams |
| Organizations | Org management | Licensing tracking |
| Checklists | Checklist overview | Hierarchy view |
| Setup | Configuration | Env guide + help |

## 🔐 Credentials (Already Set in .env)

```env
VITE_SUPABASE_URL=https://brqlnvfphyeggycsrvag.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**No setup needed!** These are pre-configured and ready to use.

## 🚀 Deploy

### To Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### To Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### To Any Hosting
1. Run `npm run build`
2. Copy `dist/` folder
3. Upload to hosting provider
4. Set environment variables
5. Done!

## 🆘 Troubleshooting

### Issue: Can't connect to database
**Solution:** Check internet, restart server (`npm run dev`)

### Issue: Tables are empty
**Solution:** Refresh page, clear cache (Ctrl+Shift+Delete)

### Issue: Import fails
**Solution:** Download template first, use same column names

### Issue: Slow performance
**Solution:** Import in smaller batches (100-500 rows)

## 📱 Features

✅ Dark/Light mode  
✅ Excel/CSV import  
✅ Data tables with search  
✅ Project image gallery  
✅ Status tracking  
✅ Team management  
✅ Responsive design  
✅ Smooth animations  
✅ Row-level security  
✅ Real-time updates  

## 📖 More Help

- See `README.md` for complete overview
- See `SETUP_GUIDE.md` for detailed setup
- See `ENV_SETUP.md` for environment explanation
- See `EXCEL_IMPORT_GUIDE.md` for import details

## ✅ Checklist

- [ ] Ran `npm install`
- [ ] Ran `npm run dev`
- [ ] Opened http://localhost:5173
- [ ] Explored Dashboard page
- [ ] Viewed Projects table
- [ ] Tested import (downloaded template)
- [ ] Read documentation files
- [ ] Ready to deploy!

---

**Quick Start:** `npm install && npm run dev`  
**Status:** ✅ Production Ready  
**Next:** Open http://localhost:5173
