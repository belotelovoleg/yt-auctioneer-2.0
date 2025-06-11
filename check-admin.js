const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        login: true,
        isAdmin: true,
        isActive: true
      }
    });
    
    console.log('📋 Current users:');
    console.table(users);
    
    const adminUsers = users.filter(user => user.isAdmin);
    console.log(`\n👑 Admin users: ${adminUsers.length}`);
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found!');
      console.log('💡 To make a user admin, run:');
      console.log('   UPDATE users SET "isAdmin" = true WHERE login = \'your-username\';');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
