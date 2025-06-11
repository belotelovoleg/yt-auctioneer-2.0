import { BackgroundAuctionMonitor } from './backgroundMonitor';

let isServerInitialized = false;

/**
 * Initialize all background services when the server starts
 * This should be called once when the Next.js server starts
 */
export async function initializeBackgroundServices() {
  const timestamp = new Date().toISOString();
  console.log(`🔄 initializeBackgroundServices called at ${timestamp}`);
  
  if (isServerInitialized) {
    console.log('🔄 Background services already initialized');
    return;
  }

  // Set flag immediately to prevent race conditions
  isServerInitialized = true;
  console.log(`🚀 Starting background services... (flagged at ${timestamp})`);

  try {
    // Initialize background auction monitor
    await BackgroundAuctionMonitor.initialize();

    console.log('✅ All background services initialized successfully');

    // Handle graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    console.error('❌ Failed to initialize background services:', error);
    // Reset flag on error so it can be retried
    isServerInitialized = false;
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Graceful shutdown of all background services
 */
function gracefulShutdown() {
  console.log('🛑 Gracefully shutting down background services...');
  
  try {
    BackgroundAuctionMonitor.stopAll();
    console.log('✅ Background services stopped successfully');
  } catch (error) {
    console.error('❌ Error during background services shutdown:', error);
  }
  
  process.exit(0);
}

/**
 * Get initialization status
 */
export function isBackgroundServicesInitialized(): boolean {
  return isServerInitialized;
}
