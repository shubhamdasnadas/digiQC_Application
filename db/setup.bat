@echo off
setlocal

set digiQC=digiQC
set postgres=postgres

echo Creating database...
createdb digiQC

echo Running setup...
psql -d digiQC -f "db/setup.sql"

echo Granting permissions to postgres...
psql -d digiQC -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;"
psql -d digiQC -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;"

echo Done. Run 'node scripts/seed.js' for demo data, then 'npm run dev' to start the app.
