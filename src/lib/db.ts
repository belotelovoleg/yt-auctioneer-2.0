import { PrismaClient } from '../generated/prisma'
import { getEnvVar } from './env-config'

// Configure DATABASE_URL with fallback
const databaseUrl = getEnvVar('DATABASE_URL')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  },
  log: process.env.AWS_LAMBDA_FUNCTION_NAME ? ['error'] : ['query', 'info', 'warn', 'error']
})

// In AWS Lambda, don't store the client globally to avoid connection pool issues
if (getEnvVar('NODE_ENV') !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  globalForPrisma.prisma = prisma
}

// Add graceful shutdown for Lambda
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}
