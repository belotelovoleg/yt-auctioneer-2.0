// Simple script to make a user admin
// Usage: node scripts/make-admin.js <login>

const { PrismaClient } = require('../src/generated/prisma');

async function makeUserAdmin(login) {
  const prisma = new PrismaClient();
  
  try {
    const user = await prisma.user.update({
      where: { login },
      data: { isAdmin: true },
      select: { id: true, login: true, isAdmin: true }
    });
    
    console.log('✅ User updated successfully:', user);
  } catch (error) {
    if (error.code === 'P2025') {
      console.error('❌ User not found:', login);
    } else {
      console.error('❌ Error updating user:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const login = process.argv[2];
if (!login) {
  console.error('Usage: node scripts/make-admin.js <login>');
  process.exit(1);
}

makeUserAdmin(login);
