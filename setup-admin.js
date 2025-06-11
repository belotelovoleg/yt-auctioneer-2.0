// Quick script to list users and make first one admin
const { PrismaClient } = require('./src/generated/prisma');

async function setupAdmin() {
  const prisma = new PrismaClient();
  
  try {
    // List all users
    const users = await prisma.user.findMany({
      select: { id: true, login: true, isAdmin: true }
    });
    
    console.log('📋 Current users:');
    users.forEach(user => {
      console.log(`  ${user.id}: ${user.login} (admin: ${user.isAdmin})`);
    });
    
    if (users.length === 0) {
      console.log('❌ No users found. Please register a user first.');
      return;
    }
    
    // Make first user admin
    const firstUser = users[0];
    if (!firstUser.isAdmin) {
      const updated = await prisma.user.update({
        where: { id: firstUser.id },
        data: { isAdmin: true },
        select: { id: true, login: true, isAdmin: true }
      });
      
      console.log('✅ Updated user to admin:', updated);
    } else {
      console.log('✅ User is already admin:', firstUser);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setupAdmin();
