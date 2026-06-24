@echo off
setlocal

set DB_NAME=digiQC
set DB_USER=postgres

echo Creating database...
createdb %DB_NAME%

echo Running schema...
psql -d %DB_NAME% -f "%~dp0schema.sql"

echo Granting permissions to %DB_USER%...
psql -d %DB_NAME% -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO %DB_USER%;"
psql -d %DB_NAME% -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO %DB_USER%;"

echo Done. Run 'npm run dev' to start the app.
