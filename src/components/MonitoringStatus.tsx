import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Chip, 
  CircularProgress, 
  Alert,
  Button
} from '@mui/material';
import MonitorIcon from '@mui/icons-material/Monitor';
import RefreshIcon from '@mui/icons-material/Refresh';

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

interface MonitoringStatusProps {
  refreshInterval?: number;
}

/**
 * MonitoringStatus - A component to display active background monitors
 * 
 * Usage:
 * <MonitoringStatus /> - Basic usage
 * <MonitoringStatus refreshInterval={10000} /> - Auto-refresh every 10 seconds
 */
export default function MonitoringStatus({ refreshInterval = 0 }: MonitoringStatusProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const fetchMonitorData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/background-monitor/count');
      
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

  useEffect(() => {
    fetchMonitorData();
    
    // Set up auto-refresh if interval is provided
    let intervalId: NodeJS.Timeout | null = null;
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchMonitorData, refreshInterval);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [refreshInterval]);

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
    </Paper>
  );
}
