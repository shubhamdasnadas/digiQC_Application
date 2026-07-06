/**
 * One-time migration: normalizes the shared checklist library out of the
 * flat array-column public.checklist table into public.library_checklists /
 * library_stages / library_checkpoints.
 *
 * Run: node scripts/migrate-checklist-library.js
 *
 * Prerequisite: db/migration_checklist_library_normalize.sql must already
 * have been run to create the target tables.
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'digiQC',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
});

function toInputType(yn) {
  return (yn || '').trim().toUpperCase() === 'TEXT' ? 'text' : 'yes_no';
}

async function migrate() {
  const client = await pool.connect();
  console.log('Connected to PostgreSQL\n');

  try {
    const { rows: sourceRows } = await client.query(`
      SELECT checklist_name[1] AS name, reference_number[1] AS reference_number,
             stage_name[1] AS stage_name, checkpoint[1] AS checkpoint,
             yn[1] AS yn, photo[1] AS photo, remark[1] AS remark
      FROM public.checklist
      ORDER BY ctid
    `);
    console.log(`Read ${sourceRows.length} rows from public.checklist`);

    await client.query('BEGIN');

    const checklistIdByRef = new Map();
    const stageIdByKey = new Map(); // key: reference_number + '::' + stage_name
    const stageCountByChecklist = new Map();
    const checkpointCountByStage = new Map();

    let checklistCount = 0;
    let stageCount = 0;
    let checkpointCount = 0;

    for (const row of sourceRows) {
      let checklistId = checklistIdByRef.get(row.reference_number);
      if (!checklistId) {
        const { rows } = await client.query(
          `INSERT INTO public.library_checklists (name, reference_number) VALUES ($1, $2) RETURNING id`,
          [row.name, row.reference_number]
        );
        checklistId = rows[0].id;
        checklistIdByRef.set(row.reference_number, checklistId);
        stageCountByChecklist.set(checklistId, 0);
        checklistCount++;
      }

      const stageKey = row.reference_number + '::' + row.stage_name;
      let stageId = stageIdByKey.get(stageKey);
      if (!stageId) {
        const nextSrNo = stageCountByChecklist.get(checklistId) + 1;
        const { rows } = await client.query(
          `INSERT INTO public.library_stages (library_checklist_id, sr_no, name) VALUES ($1, $2, $3) RETURNING id`,
          [checklistId, nextSrNo, row.stage_name]
        );
        stageId = rows[0].id;
        stageIdByKey.set(stageKey, stageId);
        stageCountByChecklist.set(checklistId, nextSrNo);
        checkpointCountByStage.set(stageId, 0);
        stageCount++;
      }

      const nextCpSrNo = checkpointCountByStage.get(stageId) + 1;
      await client.query(
        `INSERT INTO public.library_checkpoints
           (library_stage_id, sr_no, question, input_type, drawing_required, witness_required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [stageId, nextCpSrNo, row.checkpoint, toInputType(row.yn), !!row.photo, !!row.remark]
      );
      checkpointCountByStage.set(stageId, nextCpSrNo);
      checkpointCount++;
    }

    await client.query('COMMIT');

    console.log(`\nInserted ${checklistCount} checklists, ${stageCount} stages, ${checkpointCount} checkpoints.`);

    if (checklistCount !== 74 || checkpointCount !== sourceRows.length) {
      console.warn(`\nWARNING: expected 74 checklists and ${sourceRows.length} checkpoints, got ${checklistCount} checklists and ${checkpointCount} checkpoints. Review before dropping old tables.`);
    } else {
      console.log('\nCounts match expected totals (74 checklists). Safe to proceed with verification, then drop the old tables.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
