import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'userData.json');

export async function GET() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return NextResponse.json(JSON.parse(data));
    }
    return NextResponse.json({ progress: null, notes: null });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
