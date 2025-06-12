import { prisma } from './db';
import { BidProcessingService } from './bidProcessing';
import { YouTubeService } from './youtube';
import * as fs from 'fs';
import * as path from 'path';

interface MonitoringJob {
  auctionId: number;
  lotId: number;
  interval: NodeJS.Timeout;
  lastProcessedTime: Date;
  nextPageToken?: string;
  currentPollingInterval: number; // Dynamic interval from YouTube API
  auctionNotFoundCount: number; // Count of consecutive auction not found errors
  lotNotFoundCount: number; // Count of consecutive lot not found errors
}

interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  auctionId?: number;
  lotId?: number;
  metadata?: any;
}

export class BackgroundAuctionMonitor {
  private static monitoringJobs = new Map<string, MonitoringJob>();
  private static isInitialized = false;
  private static logs = new Map<string, LogEntry[]>(); // Keep in-memory for backward compatibility
  private static globalLogs: LogEntry[] = [];  private static readonly MAX_LOGS_PER_JOB = 100;
  private static readonly MAX_GLOBAL_LOGS = 200;
  private static readonly LOGS_DIR = '/tmp/logs/monitor'; // Use /tmp for AWS Lambda
  private static readonly GLOBAL_LOG_FILE = path.join(BackgroundAuctionMonitor.LOGS_DIR, 'global.jsonl');
  private static readonly IS_LAMBDA = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
  
  /**
   * Ensure logs directory exists (only in non-Lambda environments)
   */
  private static ensureLogsDirectory() {
    // Skip file logging in Lambda environment
    if (BackgroundAuctionMonitor.IS_LAMBDA) {
      return;
    }
    
    try {
      if (!fs.existsSync(BackgroundAuctionMonitor.LOGS_DIR)) {
        fs.mkdirSync(BackgroundAuctionMonitor.LOGS_DIR, { recursive: true });
      }
    } catch (error) {
      console.warn('Could not create logs directory:', error);
    }
  }

  /**
   * Get log file path for a specific job
   */
  private static getJobLogFile(auctionId: number, lotId: number): string {
    return path.join(BackgroundAuctionMonitor.LOGS_DIR, `job-${auctionId}-${lotId}.jsonl`);
  }/**
   * Add a log entry to the appropriate buffer (per-job or global) and write to files
   */
  private static addLog(level: LogEntry['level'], message: string, auctionId?: number, lotId?: number, metadata?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      auctionId,
      lotId,
      metadata
    };    try {
      // Skip file operations in Lambda environment
      if (!BackgroundAuctionMonitor.IS_LAMBDA) {
        this.ensureLogsDirectory();

        // Write to files first (most important for persistence)
        if (auctionId && lotId) {
          // Write to job-specific log file
          const jobLogFile = this.getJobLogFile(auctionId, lotId);
          fs.appendFileSync(jobLogFile, JSON.stringify(logEntry) + '\n');
        }

        // Always write to global log file
        fs.appendFileSync(BackgroundAuctionMonitor.GLOBAL_LOG_FILE, JSON.stringify(logEntry) + '\n');
        
        // Rotate global log file if it gets too large (check every 10th log entry to avoid excessive file stats)
        if (Math.random() < 0.1) {
          this.rotateGlobalLogFile();
        }
      }

      // Add to in-memory logs (always, for both Lambda and non-Lambda)
      if (auctionId && lotId) {
        const key = `${auctionId}-${lotId}`;
        if (!this.logs.has(key)) {
          this.logs.set(key, []);
        }
        const jobLogs = this.logs.get(key)!;
        jobLogs.push(logEntry);
        if (jobLogs.length > this.MAX_LOGS_PER_JOB) {
          this.logs.set(key, jobLogs.slice(-this.MAX_LOGS_PER_JOB));
        }
      }
      
      // Also add to in-memory global logs
      this.globalLogs.push(logEntry);
      if (this.globalLogs.length > this.MAX_GLOBAL_LOGS) {
        this.globalLogs = this.globalLogs.slice(-this.MAX_GLOBAL_LOGS);
      }

    } catch (error) {
      console.error('❌ Failed to write log to file:', error);
      // Still add to in-memory as fallback
      if (auctionId && lotId) {
        const key = `${auctionId}-${lotId}`;
        if (!this.logs.has(key)) {
          this.logs.set(key, []);
        }
        const jobLogs = this.logs.get(key)!;
        jobLogs.push(logEntry);
        if (jobLogs.length > this.MAX_LOGS_PER_JOB) {
          this.logs.set(key, jobLogs.slice(-this.MAX_LOGS_PER_JOB));
        }
      }
      this.globalLogs.push(logEntry);
      if (this.globalLogs.length > this.MAX_GLOBAL_LOGS) {
        this.globalLogs = this.globalLogs.slice(-this.MAX_GLOBAL_LOGS);
      }
    }

    // Also log to console for development
    const prefix = auctionId && lotId ? `[${auctionId}-${lotId}]` : '';
    switch (level) {
      case 'INFO':
        console.log(`ℹ️  ${prefix} ${message}`, metadata || '');
        break;
      case 'WARN':
        console.warn(`⚠️  ${prefix} ${message}`, metadata || '');
        break;
      case 'ERROR':
        console.error(`❌ ${prefix} ${message}`, metadata || '');
        break;
      case 'DEBUG':
        console.log(`🔍 ${prefix} ${message}`, metadata || '');
        break;
    }
  }  /**
   * Read logs from a file (JSONL format) - skip in Lambda environment
   */
  private static readLogsFromFile(filePath: string, count?: number): LogEntry[] {
    // Skip file operations in Lambda environment
    if (BackgroundAuctionMonitor.IS_LAMBDA) {
      return [];
    }
    
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      const logs: LogEntry[] = [];
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          // Ensure timestamp is a Date object
          logEntry.timestamp = new Date(logEntry.timestamp);
          logs.push(logEntry);
        } catch (parseError) {
          console.error('Failed to parse log line:', line, parseError);
        }
      }

      // Sort by timestamp (newest first) and limit if requested
      logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return count ? logs.slice(0, count) : logs;

    } catch (error) {
      console.error('Failed to read log file:', filePath, error);
      return [];
    }
  }

  /**
   * Get logs for a specific monitor job
   */
  static getJobLogs(auctionId: number, lotId: number, count?: number): LogEntry[] {
    // Try to read from file first
    const jobLogFile = this.getJobLogFile(auctionId, lotId);
    const fileLogs = this.readLogsFromFile(jobLogFile, count);
    
    if (fileLogs.length > 0) {
      return fileLogs;
    }

    // Fallback to in-memory logs
    const key = `${auctionId}-${lotId}`;
    const jobLogs = this.logs.get(key) || [];
    const logsToReturn = count ? jobLogs.slice(-count) : jobLogs;
    return logsToReturn.slice().reverse(); // Return newest first
  }  /**
   * Get global logs (all logs from all jobs)
   */
  static getGlobalLogs(count?: number): LogEntry[] {
    // Try to read from global log file first
    const fileLogs = this.readLogsFromFile(BackgroundAuctionMonitor.GLOBAL_LOG_FILE, count);
    
    if (fileLogs.length > 0) {
      return fileLogs;
    }

    // Fallback to in-memory logs
    const logsToReturn = count ? this.globalLogs.slice(-count) : this.globalLogs;
    return logsToReturn.slice().reverse(); // Return newest first
  }

  /**
   * Get recent logs (backward compatibility - returns global logs)
   */
  static getLogs(count?: number): LogEntry[] {
    return this.getGlobalLogs(count);
  }  /**
   * Get all available log keys (monitor job identifiers)
   */
  static getAvailableLogKeys(): string[] {
    const keys = new Set<string>();
    
    // Add keys from in-memory logs
    Array.from(this.logs.keys()).forEach(key => keys.add(key));
    
    // Skip file operations in Lambda environment
    if (!BackgroundAuctionMonitor.IS_LAMBDA) {
      try {
        this.ensureLogsDirectory();
        
        // Add keys from log files
        const files = fs.readdirSync(BackgroundAuctionMonitor.LOGS_DIR);
        for (const file of files) {
          if (file.startsWith('job-') && file.endsWith('.jsonl')) {
            // Extract job key from filename: job-1-1.jsonl -> 1-1
            const match = file.match(/^job-(\d+-\d+)\.jsonl$/);
            if (match) {
              keys.add(match[1]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to read logs directory:', error);
      }
    }
    
    return Array.from(keys).sort();
  }
  /**
   * Rotate global log file if it gets too large - skip in Lambda
   */
  private static rotateGlobalLogFile() {
    // Skip file operations in Lambda environment
    if (BackgroundAuctionMonitor.IS_LAMBDA) {
      return;
    }
    
    try {
      if (!fs.existsSync(BackgroundAuctionMonitor.GLOBAL_LOG_FILE)) {
        return;
      }

      const stats = fs.statSync(BackgroundAuctionMonitor.GLOBAL_LOG_FILE);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Rotate if file is larger than 10MB
      if (fileSizeMB > 10) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = path.join(BackgroundAuctionMonitor.LOGS_DIR, `global-${timestamp}.jsonl`);
        
        // Move current file to archive
        fs.renameSync(BackgroundAuctionMonitor.GLOBAL_LOG_FILE, archiveFile);
        
        console.log(`📦 Rotated global log file: ${fileSizeMB.toFixed(2)}MB → ${archiveFile}`);
        
        // Clean up old archive files (keep only last 5)
        this.cleanupOldLogFiles();
      }
    } catch (error) {
      console.error('Failed to rotate global log file:', error);
    }
  }

  /**
   * Clean up old archived log files (keep only the 5 most recent)
   */
  private static cleanupOldLogFiles() {
    try {
      const files = fs.readdirSync(BackgroundAuctionMonitor.LOGS_DIR);
      const archiveFiles = files
        .filter(file => file.startsWith('global-') && file.endsWith('.jsonl'))
        .map(file => ({
          name: file,
          path: path.join(BackgroundAuctionMonitor.LOGS_DIR, file),
          mtime: fs.statSync(path.join(BackgroundAuctionMonitor.LOGS_DIR, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 5 most recent archive files
      const filesToDelete = archiveFiles.slice(5);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Deleted old log archive: ${file.name}`);
      }
      
      if (filesToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${filesToDelete.length} old log archive files`);
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Add a test log entry (for debugging)
   */
  static addTestLog() {
    this.addLog('INFO', 'Test log entry added manually', 1, 1);
    console.log('✅ Test log added. Current counts:', {
      globalLogs: this.globalLogs.length,
      jobLogs: this.logs.get('1-1')?.length || 0
    });
  }  /**
   * Clean up logs for a specific monitor job
   */
  private static cleanupJobLogs(auctionId: number, lotId: number) {
    const key = `${auctionId}-${lotId}`;
    
    // Remove from in-memory storage
    this.logs.delete(key);
    
    // Remove the job-specific log file to prevent HDD flooding
    try {
      const jobLogFile = this.getJobLogFile(auctionId, lotId);
      if (fs.existsSync(jobLogFile)) {
        fs.unlinkSync(jobLogFile);
        this.addLog('INFO', `Deleted log file: ${jobLogFile}`, auctionId, lotId);
      }
    } catch (error) {
      this.addLog('WARN', 'Failed to delete job log file', auctionId, lotId, error);
    }
    
    this.addLog('INFO', `Cleaned up logs for monitoring job`, auctionId, lotId);
  }/**
   * Initialize background monitoring service
   * Called when server starts
   */  static async initialize() {
    if (this.isInitialized) {
      this.addLog('INFO', 'Background auction monitor already initialized');
      return;
    }

    // Set initialized flag immediately to prevent race conditions
    this.isInitialized = true;
    this.addLog('INFO', 'Initializing background auction monitor...');

    try {
      // Find all lots currently being sold and start monitoring them
      const activeLots = await (prisma as any).lot.findMany({
        where: { status: 'BEING_SOLD' },
        include: {
          auctionLots: {
            include: {
              auction: true
            }
          }
        }
      });

      this.addLog('INFO', `Found ${activeLots.length} active lots to monitor`);

      let monitoringStarted = 0;
      for (const lot of activeLots) {
        for (const auctionLot of lot.auctionLots) {
          if (auctionLot.auction.youtubeVideoId || auctionLot.auction.youtubeChannelId) {
            const started = await this.startMonitoring(auctionLot.auction.id, lot.id);
            
            if (started) {
              monitoringStarted++;
              this.addLog('INFO', `Started monitoring`, auctionLot.auction.id, lot.id);
            } else {
              this.addLog('ERROR', `Failed to start monitoring`, auctionLot.auction.id, lot.id);
            }
          }
        }
      }

      this.addLog('INFO', `Background auction monitor initialized successfully (${monitoringStarted} jobs started)`);

    } catch (error) {
      this.addLog('ERROR', 'Failed to initialize background auction monitor', undefined, undefined, error);
      // Reset flag on error so it can be retried
      this.isInitialized = false;
    }
  }/**
   * Start monitoring a specific auction/lot
   */  static async startMonitoring(auctionId: number, lotId: number): Promise<boolean> {
    const key = `${auctionId}-${lotId}`;    
    
    // Check if already monitoring this lot
    if (this.monitoringJobs.has(key)) {
      const existingJob = this.monitoringJobs.get(key);
      
      // Check if existing job already has an active interval
      if (existingJob && existingJob.interval) {
        this.addLog('INFO', `Already monitoring with active interval - skipping duplicate`, auctionId, lotId);
        console.log(`✅ Already monitoring lot ${lotId} with active interval - preventing duplicate polling cycle`);
        return true;
      } else if (existingJob) {
        // If job exists but has no interval, log it but continue to recreate the interval
        this.addLog('WARN', `Found inactive monitor job - reactivating`, auctionId, lotId);
        console.log(`⚠️ Found inactive monitor for lot ${lotId} - reactivating polling cycle`);
        // Don't return, allow process to continue and set up the interval
      } else {
        this.addLog('INFO', `Already monitoring - skipping duplicate`, auctionId, lotId);
        return true;
      }
    }

    try {
      // Verify auction and lot exist and are valid for monitoring
      const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: { youtubeVideoId: true, youtubeChannelId: true, status: true }
      });

      const lot = await (prisma as any).lot.findUnique({
        where: { id: lotId },
        select: { status: true }
      });      if (!auction || !lot) {
        this.addLog('ERROR', 'Auction or Lot not found', auctionId, lotId);
        return false;
      }

      if (lot.status !== 'BEING_SOLD') {
        this.addLog('WARN', `Lot is not being sold (status: ${lot.status})`, auctionId, lotId);
        return false;
      }

      if (!auction.youtubeVideoId && !auction.youtubeChannelId) {
        this.addLog('WARN', 'Auction has no YouTube configuration', auctionId, lotId);
        return false;
      }

      // Create database record for monitoring job
      await (prisma as any).monitoringJob.upsert({
        where: { 
          auctionId_lotId: { auctionId, lotId }
        },
        update: {
          isActive: true,
          lastProcessedTime: new Date(),
          updatedAt: new Date()
        },
        create: {
          auctionId,
          lotId,
          isActive: true,
          lastProcessedTime: new Date(),
          currentPollingInterval: 10000,
          auctionNotFoundCount: 0,
          lotNotFoundCount: 0
        }
      });      // Create a placeholder job immediately to prevent race conditions
      if (!this.monitoringJobs.has(key)) {
        this.monitoringJobs.set(key, {
          auctionId,
          lotId,
          interval: null as any,
          lastProcessedTime: new Date(),
          nextPageToken: undefined,
          currentPollingInterval: 10000, // Start with 10 seconds, will be updated by YouTube API
          auctionNotFoundCount: 0,
          lotNotFoundCount: 0
        });
      }

      // Create recursive processing function with dynamic delays
      const recursiveProcessing = async () => {
        await this.processLotBids(auctionId, lotId);
        
        // Schedule next execution if monitoring job still exists
        const job = this.monitoringJobs.get(key);
        if (job) {
          job.interval = setTimeout(recursiveProcessing, job.currentPollingInterval);
        }
      };      // Update the existing job with the interval (placeholder job was already created)
      const job = this.monitoringJobs.get(key);
      if (job) {
        // Clear any existing interval to prevent duplicate polling cycles
        if (job.interval) {
          clearTimeout(job.interval);
          console.log(`🔄 Cleared existing interval for lot ${lotId} to prevent duplicate polling`);
          this.addLog('INFO', `Cleared existing interval before starting new one`, auctionId, lotId);
        }

        console.log(`🔄 Started background monitoring for ${key} with dynamic delays`);
        console.log(`🚀 Starting first processing cycle`);
        
        // Extra safeguard: check if this lot has any other active monitors from different auctions
        // This is a rare case but can happen if a lot is included in multiple auctions
        const allKeys = Array.from(this.monitoringJobs.keys());
        for (const otherKey of allKeys) {
          if (otherKey !== key && otherKey.endsWith(`-${lotId}`)) {
            const [otherAuctionId, otherLotId] = otherKey.split('-').map(Number);
            if (otherLotId === lotId) {
              // Found another monitor for the same lot but different auction
              const otherJob = this.monitoringJobs.get(otherKey);
              if (otherJob && otherJob.interval) {
                clearTimeout(otherJob.interval);
                console.log(`⚠️ Found another monitor for lot ${lotId} in auction ${otherAuctionId} - stopping it`);
                this.addLog('WARN', `Found duplicate lot monitor in another auction - stopping it`, otherAuctionId, lotId);
                this.monitoringJobs.delete(otherKey);
              }
            }
          }
        }
        
        // Start the recursive processing loop
        recursiveProcessing();
      }

      return true;

    } catch (error) {
      console.error(`❌ Failed to start monitoring ${key}:`, error);
      // Remove the placeholder job on error
      this.monitoringJobs.delete(key);
      
      // Remove from database on error
      try {
        await (prisma as any).monitoringJob.deleteMany({
          where: { auctionId, lotId }
        });
      } catch (dbError) {
        console.error(`❌ Failed to clean up database record for ${key}:`, dbError);
      }
      
      return false;
    }
  }  /**
   * Stop monitoring a specific auction/lot
   */  static async stopMonitoring(auctionId: number, lotId: number): Promise<boolean> {
    const key = `${auctionId}-${lotId}`;
    const job = this.monitoringJobs.get(key);    try {
      // Always update database first, regardless of in-memory job state
      await (prisma as any).monitoringJob.updateMany({
        where: { auctionId, lotId },
        data: { isActive: false, updatedAt: new Date() }
      });
      this.addLog('INFO', 'Database record marked inactive', auctionId, lotId);
    } catch (error) {
      this.addLog('WARN', 'Could not mark database record as inactive', auctionId, lotId, error);
    }

    if (!job) {
      this.addLog('INFO', 'Not monitoring in memory - but database record updated', auctionId, lotId);
      return true; // Return true since we successfully updated the database
    }

    clearTimeout(job.interval);
    const wasDeleted = this.monitoringJobs.delete(key);

    // Clear YouTube live chat ID cache for this auction to save memory and prevent stale data
    try {
      const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: { youtubeVideoId: true, youtubeChannelId: true }
      });
      
      if (auction?.youtubeVideoId) {
        YouTubeService.clearLiveChatIdCache(auction.youtubeVideoId);
        this.addLog('INFO', `Cleared YouTube cache for video ${auction.youtubeVideoId}`, auctionId, lotId);
      }
    } catch (error) {
      this.addLog('WARN', 'Could not clear YouTube cache', auctionId, lotId, error);
    }    this.addLog('INFO', `Stopped monitoring (deleted: ${wasDeleted}, remaining jobs: ${this.monitoringJobs.size})`, auctionId, lotId);
    
    // Clean up job-specific logs when stopping monitoring
    this.cleanupJobLogs(auctionId, lotId);
    
    return true;
  }

  /**
   * Process bids for a specific lot (called by background job)
   */  private static async processLotBids(auctionId: number, lotId: number) {
    const key = `${auctionId}-${lotId}`;
    const job = this.monitoringJobs.get(key);

    if (!job) {
      console.log(`⚠️  No monitoring job found for ${key} - stopping execution`);
      return;
    }

    try {      // Get auction details
      const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: { youtubeVideoId: true, youtubeChannelId: true }
      });

      if (!auction) {
        job.auctionNotFoundCount++;
        console.error(`❌ Auction ${auctionId} not found (attempt ${job.auctionNotFoundCount}/5) for ${key}`);
          if (job.auctionNotFoundCount >= 5) {
          console.error(`💀 Auction ${auctionId} not found 5 times - killing monitoring job for ${key}`);
          await this.stopMonitoring(auctionId, lotId);
          return;
        }
        // Skip this iteration but keep monitoring
        return;
      } else {
        // Reset counter on success
        job.auctionNotFoundCount = 0;
      }

      // Check if lot still exists and is being sold
      const lot = await (prisma as any).lot.findUnique({
        where: { id: lotId },
        select: { status: true }
      });

      if (!lot) {
        job.lotNotFoundCount++;
        console.error(`❌ Lot ${lotId} not found (attempt ${job.lotNotFoundCount}/5) for ${key}`);
          if (job.lotNotFoundCount >= 5) {
          console.error(`💀 Lot ${lotId} not found 5 times - killing monitoring job for ${key}`);
          await this.stopMonitoring(auctionId, lotId);
          return;
        }
        // Skip this iteration but keep monitoring
        return;      } else {
        // Reset counter on success
        job.lotNotFoundCount = 0;
      }      // Check if lot is still being sold
      if (lot.status !== 'BEING_SOLD') {
        console.log(`⏸️ Lot ${lotId} is no longer being sold (status: ${lot.status}) - stopping monitoring for ${key}`);
        await this.stopMonitoring(auctionId, lotId);
        return;
      }

      // Build YouTube API URL
      let apiUrl = '/api/youtube/chat?';
      if (auction.youtubeVideoId) {
        apiUrl += `videoId=${auction.youtubeVideoId}`;
      } else if (auction.youtubeChannelId) {
        apiUrl += `channelId=${auction.youtubeChannelId}`;
      } else {
        console.log(`⏸️  No YouTube configuration for auction ${auctionId}`);
        return;
      }

      // Add pagination token if we have one
      if (job.nextPageToken) {
        apiUrl += `&pageToken=${job.nextPageToken}`;
      }      // Make internal API calls to our own server
      // Simple: localhost in dev, otherwise use request headers to determine our own URL
      let baseUrl: string;
      if (process.env.NODE_ENV === 'development') {
        baseUrl = 'http://localhost:3000';
      } else {
        // In production, just use the same domain we're running on
        baseUrl = 'https://' + (process.env.VERCEL_URL || 'localhost:3000');
      }
      
      const fullUrl = baseUrl.startsWith('http') ? `${baseUrl}${apiUrl}` : `https://${baseUrl}${apiUrl}`;
      
      console.log(`🔗 Constructed URL (${process.env.NODE_ENV}): ${fullUrl}`);
      
      const response = await fetch(fullUrl, {
        headers: {
          'x-internal-call': 'true',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ YouTube API error for ${key}: HTTP ${response.status}`);
        return;
      }      const data = await response.json();
      
      // Log the API response details
      const messageCount = data.messages ? data.messages.length : 0;
      const bidCount = data.bids ? data.bids.length : 0;
      this.addLog('INFO', `YouTube API response: ${messageCount} messages, ${bidCount} bids`, auctionId, lotId);
      
      // Debug: Log the polling interval from YouTube API
      if (data.pollingInterval) {
        this.addLog('DEBUG', `YouTube API recommended polling interval: ${data.pollingInterval}ms`, auctionId, lotId);
      }      // Update next page token for pagination
      if (data.nextPageToken) {
        job.nextPageToken = data.nextPageToken;
      }

      // Update polling interval if YouTube provides a recommendation
      if (data.pollingInterval && data.pollingInterval !== job.currentPollingInterval) {
        const newInterval = Math.max(data.pollingInterval, 10000); // Minimum 10 seconds, respect YouTube's recommendations
        
        if (newInterval !== job.currentPollingInterval) {
          this.addLog('INFO', `Updated polling interval: ${job.currentPollingInterval}ms → ${newInterval}ms`, auctionId, lotId);
          job.currentPollingInterval = newInterval;
        }
      }

      // Process chat bids if any
      if (data.bids && data.bids.length > 0) {
        this.addLog('INFO', `Processing ${data.bids.length} bids from YouTube chat`, auctionId, lotId);
        const chatBids = data.bids.map((bid: any) => ({
          authorName: bid.authorName || 'Unknown User',
          authorPhotoUrl: bid.authorPhotoUrl || '',
          timestamp: bid.timestamp || new Date().toISOString(),
          amount: bid.amount,
          messageId: `bg-${bid.timestamp}-${bid.authorName}-${Math.random()}`
        }));

        const result = await BidProcessingService.processYouTubeBids(
          auctionId,
          lotId,
          chatBids
        );        if (result.created > 0) {
          this.addLog('INFO', `Background processed ${result.created} new bids`, auctionId, lotId);
        }        if (result.errors.length > 0) {
          this.addLog('WARN', `Background processing errors`, auctionId, lotId, result.errors);
        }
      } else {
        this.addLog('DEBUG', `No bids found in this polling cycle`, auctionId, lotId);
      }// Update last processed time
      job.lastProcessedTime = new Date();
      
      // Update database record with processing time
      try {
        await (prisma as any).monitoringJob.update({
          where: {
            auctionId_lotId: { auctionId, lotId }
          },
          data: {
            lastProcessedTime: job.lastProcessedTime,
            currentPollingInterval: job.currentPollingInterval,
            auctionNotFoundCount: job.auctionNotFoundCount,
            lotNotFoundCount: job.lotNotFoundCount,
            nextPageToken: job.nextPageToken
          }
        });
      } catch (dbError) {
        console.warn(`⚠️  Could not update database record for ${key}:`, dbError);
      }} catch (error) {
      console.error(`❌ Error processing bids for ${key}:`, error);
        // On error, wait longer before next attempt to prevent spam
      if (job.currentPollingInterval < 60000) {
        const errorInterval = 60000; // 1 minute on error
        console.log(`⏱️  Error occurred - extending polling interval for ${key} to ${errorInterval}ms`);
        job.currentPollingInterval = errorInterval;
      }
    }
  }  /**
   * Get current monitoring status
   */
  static async getMonitoringStatus(): Promise<Array<{
    auctionId: number;
    lotId: number;
    lastProcessedTime: Date;
    currentPollingInterval: number;
    isActive: boolean;
  }>> {
    try {
      // Get active monitoring jobs from database
      const dbJobs = await (prisma as any).monitoringJob.findMany({
        where: { isActive: true }
      });
      
      const result = dbJobs.map((job: any) => ({
        auctionId: job.auctionId,
        lotId: job.lotId,
        lastProcessedTime: job.lastProcessedTime,
        currentPollingInterval: job.currentPollingInterval,
        isActive: job.isActive
      }));
      
      return result;
    } catch (error) {
      console.error('❌ Error getting monitoring status from database:', error);
      
      // Fall back to in-memory data if database fails
      const result = Array.from(this.monitoringJobs.entries()).map(([key, job]) => ({
        auctionId: job.auctionId,
        lotId: job.lotId,
        lastProcessedTime: job.lastProcessedTime,
        currentPollingInterval: job.currentPollingInterval,
        isActive: true
      }));
      
      return result;
    }
  }/**
   * Stop all monitoring (called on server shutdown)
   */
  static stopAll() {
    console.log(`⏹️  Stopping ${this.monitoringJobs.size} monitoring jobs...`);
    for (const [key, job] of this.monitoringJobs.entries()) {
      clearTimeout(job.interval);
      console.log(`⏹️  Stopped monitoring ${key}`);
    }
    
    this.monitoringJobs.clear();
    this.isInitialized = false;
    
    // Mark all database records as inactive
    (prisma as any).monitoringJob.updateMany({
      where: { isActive: true },
      data: { isActive: false, updatedAt: new Date() }
    }).catch((error: any) => {
      console.warn(`⚠️  Could not mark database records as inactive:`, error);
    });
    
    // Clear all YouTube live chat ID cache to free memory
    YouTubeService.clearLiveChatIdCache();
    console.log(`🗑️  Cleared all YouTube live chat ID cache (${this.monitoringJobs.size} jobs stopped)`);
    
    console.log('✅ All background monitoring stopped');
  }
  /**
   * Emergency cleanup - clears ALL active timers (use with caution)
   * This should only be called when there are orphaned timers
   */
  static emergencyCleanup() {
    console.log('🚨 EMERGENCY CLEANUP: Stopping ALL active timers');
    
    // Clear all our tracked jobs first
    this.stopAll();
    
    // Clear all active timers in Node.js (this is aggressive but necessary for orphaned timers)
    // Get the highest timer ID and clear all timers up to that point
    const maxTimerId = setTimeout(() => {}, 0);
    clearTimeout(maxTimerId);
    
    const timerIdNum = Number(maxTimerId);
    for (let i = 1; i <= timerIdNum; i++) {
      clearTimeout(i as any);
      clearInterval(i as any);
    }
    
    console.log(`🧹 Emergency cleanup completed - cleared all timers up to ID ${timerIdNum}`);
  }
  /**
   * Handle lot status changes
   */  static async handleLotStatusChange(lotId: number, newStatus: string, auctionId?: number) {
    console.log(`📋 Lot ${lotId} status changed to: ${newStatus}`);

    if (newStatus === 'BEING_SOLD') {
      // First, ensure we stop any existing monitors for this lot regardless of auction
      const auctionLots = await prisma.auctionLot.findMany({
        where: { lotId },
        select: { auctionId: true }
      });
      
      for (const auctionLot of auctionLots) {
        // Stop any existing monitor before starting a new one
        await this.stopMonitoring(auctionLot.auctionId, lotId);
      }

      // Check if there's already an active monitoring job in the database
      const existingJob = await prisma.monitoringJob.findFirst({
        where: { 
          lotId,
          isActive: true
        }
      });
      
      if (existingJob) {
        console.log(`⚠️ Already have active database record for lot ${lotId} - stopping old job first`);
        // Force cleanup of any existing job
        await this.stopMonitoring(existingJob.auctionId, lotId);
      }

      // Start monitoring if we have auctionId
      if (auctionId) {
        await this.startMonitoring(auctionId, lotId);
      } else {
        // Find auction for this lot
        const auctionLot = await prisma.auctionLot.findFirst({
          where: { lotId },
          include: { auction: true }
        });

        if (auctionLot) {
          await this.startMonitoring(auctionLot.auction.id, lotId);
        }
      }
    } else {
      // Stop monitoring for any auction containing this lot
      const auctionLots = await prisma.auctionLot.findMany({
        where: { lotId },
        select: { auctionId: true }
      });      for (const auctionLot of auctionLots) {
        await this.stopMonitoring(auctionLot.auctionId, lotId);
      }
    }
  }
}
