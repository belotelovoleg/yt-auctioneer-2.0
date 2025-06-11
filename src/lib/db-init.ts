import { getEnvVar } from './env-config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Initialize database schema at runtime
 * This handles the database schema synchronization that can't be done during build
 */
export async function initializeDatabase(): Promise<boolean> {
  const nodeEnv = getEnvVar('NODE_ENV');
  const databaseUrl = getEnvVar('DATABASE_URL');
  
  console.log('🔄 Initializing database schema...');
  
  // Skip in development or if DATABASE_URL is not available
  if (nodeEnv === 'development') {
    console.log('⏭️ Skipping database initialization in development mode');
    return true;
  }
  
  // Skip schema push in AWS Lambda - assume it's already done
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.log('⏭️ Skipping database schema push in AWS Lambda environment');
    return true;
  }
  
  if (!databaseUrl || databaseUrl.includes('fallback-not-found')) {
    console.log('⚠️ DATABASE_URL not available, skipping schema sync');
    return false;
  }
  
  try {
    // Use Prisma CLI to push schema to database
    console.log('📤 Pushing database schema...');
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (stderr) {
      console.warn('⚠️ Database schema push warnings:', stderr);
    }
    
    console.log('✅ Database schema synchronized successfully');
    console.log(stdout);
    return true;
    
  } catch (error: any) {
    console.error('❌ Failed to initialize database schema:', error.message);
    
    // Don't fail the app startup if database sync fails
    // The app should still be able to serve static content
    return false;
  }
}

/**
 * Check if database is available and responsive
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Import prisma here to avoid issues during build
    const { prisma } = await import('./db');
    
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection verified');
    return true;
    
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
