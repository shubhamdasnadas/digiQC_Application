@echo off
setlocal

set digiQC=digiQC
set postgres=postgres

echo Creating database...
createdb digiQC

echo Running schema...
psql -d digiQC -f "db/schema.sql"

echo Granting permissions to postgres...
psql -d digiQC -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;"
psql -d digiQC -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;"

echo Done. Run 'npm run dev' to start the app.
