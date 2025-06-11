import { initializeBackgroundServices } from '@/lib/backgroundServices';
import { initializeDatabase, checkDatabaseConnection } from '@/lib/db-init';

// Use global object to ensure true singleton across module re-imports
declare global {
  var __serverInitSingleton: {
    hasInitialized: boolean;
    initPromise: Promise<void> | null;
  } | undefined;
}

// Initialize global singleton if it doesn't exist
if (typeof window === 'undefined' && !globalThis.__serverInitSingleton) {
  globalThis.__serverInitSingleton = {
    hasInitialized: false,
    initPromise: null
  };
}

// Global singleton to ensure initialization happens only once across all imports
class ServerInitSingleton {
  static async initialize() {
    // Only run on server side
    if (typeof window !== 'undefined') {
      return;
    }

    const singleton = globalThis.__serverInitSingleton!;
    
    // If already initialized or currently initializing, return existing promise
    if (singleton.hasInitialized) {
      console.log('🎯 ServerInit: Already initialized, skipping');
      return;
    }
    
    if (singleton.initPromise) {
      console.log('🎯 ServerInit: Initialization in progress, waiting...');
      return singleton.initPromise;
    }

    // Mark as initializing immediately
    console.log('🎯 ServerInit: Starting initialization...');
    singleton.initPromise = this.doInitialize();
    
    try {
      await singleton.initPromise;
      singleton.hasInitialized = true;
      console.log('🎯 ServerInit: Initialization completed successfully');
    } catch (error) {
      // Reset on error so it can be retried
      singleton.initPromise = null;
      console.error('🎯 ServerInit: Initialization failed, will retry on next import');
      throw error;
    }
  }
  private static async doInitialize() {
    console.log('🎯 ServerInit: Initializing database...');
    const dbInitialized = await initializeDatabase();
    
    if (dbInitialized) {
      console.log('🎯 ServerInit: Database initialization completed');
      
      // Only check connection if initialization was successful
      const dbConnected = await checkDatabaseConnection();
      if (!dbConnected) {
        console.warn('🎯 ServerInit: Database connection check failed, but continuing...');
      }
    } else {
      console.warn('🎯 ServerInit: Database initialization skipped or failed, continuing...');
    }
    
    console.log('🎯 ServerInit: Calling initializeBackgroundServices...');
    await initializeBackgroundServices();
    console.log('🎯 ServerInit: initializeBackgroundServices completed');
  }
}

// Initialize background services when this module loads (server-side only)
if (typeof window === 'undefined') {
  ServerInitSingleton.initialize().catch(error => {
    console.error('🎯 ServerInit: Module-level initialization failed:', error);
  });
}

export default function ServerInit() {
  // This component doesn't render anything, just initializes services
  return null;
}
