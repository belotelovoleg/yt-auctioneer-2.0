import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/users - Get all users
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        login: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Don't return password for security
      },
    });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const { login, password, isActive = true } = await request.json();
    
    if (!login || !password) {
      return NextResponse.json(
        { error: 'Login and password are required' },
        { status: 400 }
      );
    }
      const user = await prisma.user.create({
      data: {
        login,
        password: await bcrypt.hash(password, 12), // Hash the password
        isActive,
      },
      select: {
        id: true,
        login: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error('Database error:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'User with this login already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}