import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/config-env';
import bcrypt from 'bcryptjs';

const JWT_SECRET_ENCODED = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_ENCODED);
    return payload as { userId: number; login: string };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// PUT /api/users/change-password - Change user password
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Get current user from database
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, password: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await prisma.user.update({
      where: { id: user.userId },
      data: { password: hashedNewPassword },
    });

    return NextResponse.json({ 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}

