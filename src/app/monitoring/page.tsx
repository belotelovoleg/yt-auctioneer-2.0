import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert,
  Paper,
  Divider,
  Stack,
  Grid
} from '@mui/material';
import Link from 'next/link';
import MonitoringStatus from '@/components/MonitoringStatus';

export default function MonitoringPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ success: boolean; message?: string } | null>(null);

  useEffect(() => {
    // Redirect non-admin users
    if (!authLoading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleCleanupAll = async () => {
    if (!confirm('Are you sure you want to stop all monitoring jobs?')) return;
    
    try {
      setCleanupLoading(true);
      const response = await fetch('/api/background-monitor/cleanup', {
        method: 'DELETE'
      });
      
      const result = await response.json();
      setCleanupResult(result);
      
      // Auto-hide success message after 5 seconds
      if (result.success) {
        setTimeout(() => {
          setCleanupResult(null);
        }, 5000);
      }
    } catch (error) {
      setCleanupResult({ success: false, message: 'Failed to cleanup monitoring jobs' });
    } finally {
      setCleanupLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user || !user.isAdmin) {
    return null; // Let the useEffect redirect handle this
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Monitoring Dashboard
      </Typography>
      
      <Typography variant="body1" paragraph>
        Monitor and manage background auction monitoring jobs.
      </Typography>
      
      {cleanupResult && (
        <Alert 
          severity={cleanupResult.success ? "success" : "error"}
          sx={{ mb: 3 }}
          onClose={() => setCleanupResult(null)}
        >
          {cleanupResult.message || (cleanupResult.success 
            ? 'Successfully cleaned up monitoring jobs' 
            : 'Failed to clean up monitoring jobs')}
        </Alert>
      )}
        {/* Monitor Status Component */}
      <MonitoringStatus refreshInterval={30000} />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Monitoring Actions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              <Link href="/api/background-monitor/status" target="_blank" passHref>
                <Button variant="outlined" color="primary" fullWidth component="a">
                  View Raw Monitoring Status
                </Button>
              </Link>
              
              <Link href="/api/background-monitor/logs" target="_blank" passHref>
                <Button variant="outlined" color="secondary" fullWidth component="a">
                  View Monitor Logs
                </Button>
              </Link>
              
              <Button 
                variant="contained" 
                color="error" 
                onClick={handleCleanupAll}
                disabled={cleanupLoading}
              >
                {cleanupLoading ? 'Cleaning up...' : 'Cleanup All Monitors'}
              </Button>
            </Stack>          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Monitoring Info
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box>
              <Typography variant="body2" paragraph>
                The monitoring system automatically tracks YouTube live chat for bids when a lot is being sold.
              </Typography>
              <Typography variant="body2" paragraph>
                Monitors are automatically started when:
              </Typography>
              <ul>
                <li>A lot status is changed to BEING_SOLD</li>
                <li>A page with a BEING_SOLD lot is loaded</li>
                <li>The server starts and finds lots with BEING_SOLD status</li>
              </ul>
              <Typography variant="body2">
                Monitors are automatically stopped when:
              </Typography>
              <ul>
                <li>A lot status is changed from BEING_SOLD to something else</li>
                <li>The server is shutdown gracefully</li>
                <li>The cleanup button above is clicked</li>
              </ul>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
