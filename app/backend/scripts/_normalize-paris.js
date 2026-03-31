/**
 * One-time fix: apply min-max normalization to kpi_paris_arrondissement scores.
 */
const db = require('../config/database');

async function run() {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT id, arrondissement, public_parking_spaces FROM kpi_paris_arrondissement ORDER BY public_parking_spaces DESC'
    );
    if (!rows.length) { console.log('No rows found.'); return; }

    const vals = rows.map((r) => Number(r.public_parking_spaces));
    const minP = Math.min(...vals);
    const maxP = Math.max(...vals);
    const rangeP = maxP - minP || 1;

    console.log(`Places range: ${minP} – ${maxP}`);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const score = +((((Number(r.public_parking_spaces) - minP) / rangeP) * 100).toFixed(2));
      await conn.execute(
        'UPDATE kpi_paris_arrondissement SET parking_supply_score=?, potential_for_sharing=?, ranking=? WHERE id=?',
        [score, score, i + 1, r.id]
      );
      console.log(`  ${i + 1}. ${r.arrondissement}: ${score.toFixed(2)}%`);
    }
    console.log('\nDone.');
  } finally {
    conn.release();
    process.exit(0);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
