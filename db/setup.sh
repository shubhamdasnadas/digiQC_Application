#!/bin/bash
set -e

DB_NAME="digiQC"
DB_USER="postgres"

echo "Creating database..."
createdb "$DB_NAME"

echo "Running setup..."
psql -d "$DB_NAME" -f "$(dirname "$0")/setup.sql"

echo "Granting permissions to $DB_USER..."
psql -d "$DB_NAME" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER;"
psql -d "$DB_NAME" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

echo "Done. Run 'node scripts/seed.js' for demo data, then 'npm run dev' to start the app."
