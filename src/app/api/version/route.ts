import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

export async function GET() {
  try {
    return NextResponse.json({
      version: packageJson.version,
      name: packageJson.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}
