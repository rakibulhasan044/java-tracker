import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL
    })
  : null;

// Initialize the database table if it doesn't exist
async function initDb() {
  if (!pool) return false;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_data (
        id INT PRIMARY KEY,
        progress JSONB,
        notes JSONB
      );
    `);
    
    // Ensure the single user row exists
    await pool.query(`
      INSERT INTO user_data (id, progress, notes) 
      VALUES (1, '{}'::jsonb, '{}'::jsonb) 
      ON CONFLICT (id) DO NOTHING;
    `);
    
    return true;
  } catch (err) {
    console.error("Failed to initialize database:", err);
    return false;
  }
}

export async function GET() {
  try {
    if (!pool) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 });
    }
    
    await initDb();
    
    const result = await pool.query('SELECT progress, notes FROM user_data WHERE id = 1');
    if (result.rows.length > 0) {
      return NextResponse.json(result.rows[0]);
    }
    
    return NextResponse.json({ progress: null, notes: null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!pool) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 });
    }
    
    await initDb();
    const data = await request.json();
    
    await pool.query(
      'UPDATE user_data SET progress = $1, notes = $2 WHERE id = 1',
      [JSON.stringify(data.progress || {}), JSON.stringify(data.notes || {})]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
