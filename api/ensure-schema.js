const COLUMNS = [
  { name: 'position_type',   definition: "VARCHAR(10)" },
  { name: 'trade_type',      definition: "VARCHAR(20)" },
  { name: 'option_type',     definition: "VARCHAR(4)" },
  { name: 'strike_price',    definition: "DECIMAL(10,2)" },
  { name: 'expiration_date', definition: "DATE" },
  { name: 'avg_price',       definition: "DECIMAL(10,2)" },
];

/**
 * Checks information_schema for each required column and issues ALTER TABLE
 * only when the column is missing. Works on all Postgres versions.
 * Safe to call on every request — it's a no-op when the schema is up to date.
 */
export async function ensureTradesSchema(client) {
  for (const { name, definition } of COLUMNS) {
    try {
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'trades' AND column_name = $1`,
        [name]
      );
      if (rows.length === 0) {
        await client.query(
          `ALTER TABLE trades ADD COLUMN ${name} ${definition}`
        );
      }
    } catch {
      // Column check or add failed — continue so other columns still get processed
    }
  }
}
