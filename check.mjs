import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const { rows } = await client.query("select version()");
  console.log(`\nSetup works: Node ${process.version} reached ${rows[0].version.split(" (")[0]}.\n`);
} catch (error) {
  console.error(`\nSetup check failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
