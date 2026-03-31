require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../database-schema.sql');

async function initializeDatabase() {
  console.log('\n========================================');
  console.log('  PARKSHARE DATABASE INITIALIZATION');
  console.log('========================================\n');

  // Create connection without database first
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'parkuser',
      password: process.env.DB_PASSWORD === undefined ? 'parkpass' : process.env.DB_PASSWORD
    });

    console.log('✓ Connected to MySQL server\n');

    const dbName = process.env.DB_NAME || 'parkshare';

    // Drop existing database if requested
    if (process.argv.includes('--drop')) {
      console.log(`Dropping database '${dbName}'...`);
      try {
        await connection.execute(`DROP DATABASE IF EXISTS ${dbName}`);
        console.log('✓ Database dropped\n');
      } catch (error) {
        console.error('⚠ Warning: Could not drop database:', error.message);
      }
    }

    // Create database
    console.log(`Creating database '${dbName}'...`);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✓ Database created\n');

    // Switch to the database
    await connection.changeUser({ database: dbName });
    console.log(`✓ Connected to database '${dbName}'\n`);

    // Read and execute schema
    console.log('Reading schema file...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✓ Schema file loaded\n');

    // Split schema into individual statements and execute
    console.log('Creating tables...');
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    let tableCount = 0;
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE')) {
        tableCount++;
      }
      try {
        await connection.execute(statement);
      } catch (error) {
        // Some statements might fail (like DROP IF EXISTS on first run), which is ok
        if (!error.message.includes('already exists')) {
          console.warn(`⚠ Statement warning: ${error.message.substring(0, 60)}...`);
        }
      }
    }

    console.log(`✓ Database schema created (${tableCount} tables)\n`);

    // Verify tables
    console.log('Verifying tables...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);

    console.log(`✓ Database ready with ${tables.length} tables\n`);

    console.log('========================================');
    console.log('  DATABASE INITIALIZATION COMPLETE');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Copy .env.example to .env and update if needed');
    console.log('2. Run: npm run import-data\n');

  } catch (error) {
    console.error('\n✗ Initialization failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Ensure MySQL server is running');
    console.error('- Check database credentials in .env file');
    console.error('- Verify database user has CREATE DATABASE privilege\n');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initializeDatabase();
