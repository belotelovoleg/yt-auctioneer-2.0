import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Chip, 
  CircularProgress, 
  Alert,
  Button,
  LinearProgress,
  Tooltip
} from '@mui/material';
import MonitorIcon from '@mui/icons-material/Monitor';
import RefreshIcon from '@mui/icons-material/Refresh';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

interface AuctionGroup {
  auctionId: number;
  monitorCount: number;
}

interface DuplicateLot {
  lotId: number;
  monitorCount: number;
}

interface DuplicateDetail {
  lotId: number;
  auctionId: number;
  lastProcessedTime: string;
  monitorJobId: number;
  createdAt: string;
}

interface MonitorData {
  success: boolean;
  activeMonitors: number;
  totalMonitors: number;
  auctionGroups: AuctionGroup[];
  duplicateLots: DuplicateLot[] | null;
  duplicateDetails: DuplicateDetail[] | null;
  timestamp: string;
}

interface MonitorHealth {
  systemHealth: {
    totalJobs: number;
    healthyJobs: number;
    averageHealthScore: number;
    timestamp: string;
  };
  jobs: Array<{
    auctionId: number;
    lotId: number;
    lastProcessedTime: string;
    currentPollingInterval: number;
    isActive: boolean;
    timeSinceLastProcess: number;
    isHealthy: boolean;
    healthScore: number;
  }>;
}

interface MonitoringStatusProps {
  refreshInterval?: number;
  showHealth?: boolean;
}

/**
 * MonitoringStatus - A component to display active background monitors
 * 
 * Usage:
 * <MonitoringStatus /> - Basic usage
 * <MonitoringStatus refreshInterval={10000} /> - Auto-refresh every 10 seconds
 * <MonitoringStatus refreshInterval={10000} showHealth={true} /> - With health monitoring
 */
export default function MonitoringStatus({ refreshInterval = 0, showHealth = false }: MonitoringStatusProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
  // Health monitoring state
  const [healthData, setHealthData] = useState<MonitorHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  
  // Force initialization state
  const [initLoading, setInitLoading] = useState(false);
  const [initMessage, setInitMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const fetchMonitorData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/background-monitor/count', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setMonitorData(data);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchHealthData = async () => {
    if (!showHealth) return;
    
    try {
      setHealthLoading(true);
      const response = await fetch('/api/background-monitor/health', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching health data: ${response.status}`);
      }
      
      const data = await response.json();
      setHealthData(data);
      setHealthError(null);
    } catch (err) {
      setHealthError((err as Error)?.message || 'Failed to fetch health data');
      console.error('Error fetching health data:', err);
    } finally {
      setHealthLoading(false);
    }
  };
  
  // Cleanup duplicate monitors
  const cleanupDuplicates = async () => {
    if (!monitorData?.duplicateLots) return;
    
    try {
      setCleanupLoading(true);
      setCleanupMessage(null);
      
      // For each lot with duplicates, keep only the newest monitor
      for (const dupLot of monitorData.duplicateLots) {
        const details = monitorData.duplicateDetails?.filter(d => d.lotId === dupLot.lotId) || [];
        
        // Sort by lastProcessedTime (newest first)
        details.sort((a, b) => 
          new Date(b.lastProcessedTime).getTime() - new Date(a.lastProcessedTime).getTime()
        );
        
        // Keep the newest one, stop all others
        for (let i = 1; i < details.length; i++) {
          const monitor = details[i];
          await fetch('/api/background-monitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'stop',
              auctionId: monitor.auctionId,
              lotId: monitor.lotId
            })
          });
        }
      }
      
      // Refresh data
      await fetchMonitorData();
      setCleanupMessage({
        type: 'success',
        message: 'Successfully cleaned up duplicate monitors'
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setCleanupMessage(null);
      }, 5000);
      
    } catch (err) {
      setCleanupMessage({
        type: 'error',
        message: `Failed to clean up duplicates: ${(err as Error)?.message || 'Unknown error'}`
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  // Force initialization of monitors
  const handleForceInit = async () => {
    try {
      setInitLoading(true);
      setInitMessage(null);
      
      const response = await fetch('/api/background-monitor/force-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to force initialization');
      }
      
      setInitMessage({
        type: 'success',
        message: `Successfully initialized background monitor (${data.status.activeMonitors} jobs)`
      });
      
      // Refresh data after initialization
      await fetchMonitorData();
      if (showHealth) {
        await fetchHealthData();
      }
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setInitMessage(null);
      }, 5000);
    } catch (err) {
      setInitMessage({
        type: 'error',
        message: `Failed to force initialization: ${(err as Error)?.message || 'Unknown error'}`
      });
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    if (showHealth) {
      fetchHealthData();
    }
    
    let interval: NodeJS.Timeout | null = null;
    
    if (refreshInterval > 0) {
      interval = setInterval(() => {
        fetchMonitorData();
        if (showHealth) {
          fetchHealthData();
        }
      }, refreshInterval);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [refreshInterval, showHealth]);

  /**
   * Format a time difference in a human-readable format
   */
  const formatTimeDiff = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 1000) {
      return 'just now';
    }
    
    if (diffMs < 60000) {
      return `${Math.floor(diffMs / 1000)}s ago`;
    }
    
    if (diffMs < 3600000) {
      return `${Math.floor(diffMs / 60000)}m ago`;
    }
    
    if (diffMs < 86400000) {
      return `${Math.floor(diffMs / 3600000)}h ago`;
    }
    
    return `${Math.floor(diffMs / 86400000)}d ago`;
  };

  if (loading && !monitorData) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading monitor data: {error}
      </Alert>
    );
  }

  if (!monitorData) {
    return null;
  }
  const { activeMonitors, totalMonitors, auctionGroups, duplicateLots, duplicateDetails, timestamp } = monitorData;
  const hasDuplicates = duplicateLots !== null && duplicateLots.length > 0;

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" component="h2" display="flex" alignItems="center">
          <MonitorIcon sx={{ mr: 1 }} />
          Monitor Status
        </Typography>
        <Button 
          startIcon={<RefreshIcon />} 
          size="small" 
          onClick={fetchMonitorData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      <Box display="flex" flexWrap="wrap" gap={2} mb={1}>
        <Chip 
          label={`Active: ${activeMonitors}`} 
          color={activeMonitors > 0 ? "success" : "default"}
          variant="outlined"
        />
        <Chip 
          label={`Total: ${totalMonitors}`} 
          color="primary" 
          variant="outlined"
        />
        {hasDuplicates && (
          <Chip 
            label={`Duplicates: ${duplicateLots.length}`} 
            color="error" 
            variant="outlined"
          />
        )}
      </Box>

      {hasDuplicates && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">
            Duplicate monitors found for {duplicateLots.length} lot(s)!
          </Typography>
          
          {duplicateDetails && duplicateDetails.length > 0 && (
            <Box mt={1} sx={{ maxHeight: '200px', overflowY: 'auto' }}>
              <Typography variant="caption">Duplicate Monitor Details:</Typography>
              {duplicateLots.map(dup => {
                const details = duplicateDetails.filter(d => d.lotId === dup.lotId);
                return (
                  <Box key={dup.lotId} mt={1} pl={1} sx={{ borderLeft: '3px solid rgba(255,152,0,0.5)' }}>
                    <Typography variant="body2">
                      <strong>Lot {dup.lotId}</strong>: {dup.monitorCount} monitors
                    </Typography>
                    {details.map((detail, i) => (
                      <Typography variant="caption" display="block" key={detail.monitorJobId} sx={{ ml: 2 }}>
                        Monitor #{i+1}: Auction {detail.auctionId}, 
                        Last activity: {new Date(detail.lastProcessedTime).toLocaleTimeString()},
                        Created: {new Date(detail.createdAt).toLocaleTimeString()}
                      </Typography>
                    ))}
                  </Box>
                );
              })}
            </Box>
          )}
        </Alert>
      )}

      {auctionGroups.length > 0 && (
        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            Monitors by Auction:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {auctionGroups.map((group) => (
              <Chip 
                key={group.auctionId}
                label={`Auction ${group.auctionId}: ${group.monitorCount}`} 
                size="small"
                color="primary"
              />
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
        Last updated: {new Date(timestamp).toLocaleTimeString()}
      </Typography>

      {/* Health status section */}
      {showHealth && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center">
            <HealthAndSafetyIcon sx={{ mr: 1 }} />
            Monitor Health Status
            {healthLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
          </Typography>
          
          {healthData ? (
            <>
              <Box mb={2} p={2} border={1} borderColor="divider" borderRadius={1}>
                <Typography variant="subtitle1" gutterBottom>
                  System Health: {healthData.systemHealth.averageHealthScore.toFixed(1)}%
                </Typography>
                
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <LinearProgress 
                    variant="determinate" 
                    value={healthData.systemHealth.averageHealthScore} 
                    sx={{ 
                      height: 10, 
                      borderRadius: 1,
                      width: '100%',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: healthData.systemHealth.averageHealthScore > 80 
                          ? 'success.main' 
                          : healthData.systemHealth.averageHealthScore > 50 
                            ? 'warning.main' 
                            : 'error.main'
                      }
                    }} 
                  />
                </Box>
                
                <Box display="flex" flexWrap="wrap" gap={1}>
                  <Chip 
                    label={`Healthy: ${healthData.systemHealth.healthyJobs}/${healthData.systemHealth.totalJobs}`}
                    color={healthData.systemHealth.healthyJobs === healthData.systemHealth.totalJobs ? "success" : "warning"}
                    variant="outlined"
                    size="small"
                  />
                  <Chip 
                    label={`Updated: ${formatTimeDiff(healthData.systemHealth.timestamp)}`}
                    color="default"
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </Box>
              
              {healthData.jobs.length > 0 && (
                <Box maxHeight={300} overflow="auto" sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  {healthData.jobs.map(job => (
                    <Box 
                      key={`${job.auctionId}-${job.lotId}`} 
                      p={1.5} 
                      sx={{ 
                        borderBottom: 1, 
                        borderColor: 'divider',
                        backgroundColor: !job.isHealthy ? 'rgba(244,67,54,0.1)' : 'transparent'
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          <strong>Auction {job.auctionId}, Lot {job.lotId}</strong>
                        </Typography>
                        <Tooltip title={`Health Score: ${job.healthScore.toFixed(1)}%`}>
                          <Chip 
                            label={job.isHealthy ? "Healthy" : "Unhealthy"} 
                            color={job.isHealthy ? "success" : "error"}
                            size="small"
                          />
                        </Tooltip>
                      </Box>
                      <Box display="flex" gap={2} mt={0.5}>
                        <Typography variant="caption">
                          Last update: {formatTimeDiff(job.lastProcessedTime)}
                        </Typography>
                        <Typography variant="caption">
                          Polling: {job.currentPollingInterval}ms
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          ) : (
            <Alert severity="info">
              Health information is not available.
            </Alert>
          )}
        </Box>
      )}

      {/* Force Initialization Section */}
      <Box mt={3} mb={3} p={2} border={1} borderColor="divider" borderRadius={1}>
        <Typography variant="subtitle1" gutterBottom>
          Monitor Initialization Status
        </Typography>
        <Box display="flex" alignItems="center" gap={2} mt={1}>
          <Button
            variant="contained"
            color="warning"
            onClick={handleForceInit}
            disabled={initLoading}
            startIcon={<RefreshIcon />}
          >
            {initLoading ? 'Initializing...' : 'Force Initialize Monitor'}
          </Button>
          
          <Typography variant="body2" color="text.secondary">
            Use this if the background monitor isn't starting properly
          </Typography>
        </Box>
        
        {initMessage && (
          <Alert severity={initMessage.type} sx={{ mt: 2 }}>
            {initMessage.message}
          </Alert>
        )}
      </Box>
    </Paper>
  );
}
