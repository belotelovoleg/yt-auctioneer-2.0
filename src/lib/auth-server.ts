import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './db';
import { JWT_SECRET } from './env-config';

interface User {
  id: number;
  login: string;
  isAdmin: boolean;
}

export async function validateToken(request: NextRequest): Promise<User | null> {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return null;
    }    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (!decoded.userId) {
      return null;
    }    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, login: true, isActive: true, isAdmin: true }
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      login: user.login,
      isAdmin: user.isAdmin
    };

  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}
