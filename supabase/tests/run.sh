#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and runs the SQL tests.
#
#   supabase/tests/run.sh
#
# Needs a running local postgres and a superuser you can reach; override with
# PSQL="psql -U someone" if yours isn't the `postgres` system user.
set -euo pipefail

DB="${DB:-kasama_test}"
PSQL="${PSQL:-psql}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

run() { $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }

dropdb --if-exists "$DB"
createdb "$DB"

run "$ROOT/supabase/tests/00_supabase_stubs.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "-- applying $(basename "$migration")"
  run "$migration"
done

for test in "$ROOT"/supabase/tests/*_test.sql; do
  echo "-- running $(basename "$test")"
  $PSQL -q -d "$DB" -f "$test"
done
