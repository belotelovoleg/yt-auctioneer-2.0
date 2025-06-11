'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Button,
  Divider,
  ListItemButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Gavel as AuctionIcon,
  Person as ProfileIcon,
  Settings as SettingsIcon,
  Login as LoginIcon,
  PersonAdd as RegisterIcon,
  Logout as LogoutIcon,
  DarkMode,
  LightMode,
  YouTube as YouTubeIcon,  Monitor as MonitorIcon,
  Refresh as RefreshIcon,
  CleaningServices as CleanupIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useLanguage } from '@/lib/language';
import { t } from '@/lib/i18n';

interface NavbarProps {
  // No props needed anymore since we use global language context
}

interface MonitoringJob {
  auctionId: number;
  lotId: number;
  lastProcessedTime: string;
  currentPollingInterval: number;
  isActive: boolean;
}

interface MonitoringStatus {
  success: boolean;
  activeJobs: number;
  jobs: MonitoringJob[];
  summary: {
    totalJobs: number;
    jobsByAuction: Record<string, number>;
    oldestJob: number;
  };
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  auctionId?: number;
  lotId?: number;
  metadata?: any;
}

interface LogsResponse {
  success: boolean;
  logs: LogEntry[];
  totalEntries: number;
  maxEntries: number;
  type?: 'global' | 'job';
  jobKey?: string;
}

interface AvailableJobsResponse {
  success: boolean;
  availableJobs: string[];
  totalJobs: number;
}

export default function Navbar({}: NavbarProps) {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const { lang, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();  const [drawerOpen, setDrawerOpen] = useState(false);
  const [monitoringDialogOpen, setMonitoringDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [availableJobs, setAvailableJobs] = useState<string[]>([]);
  const [selectedLogType, setSelectedLogType] = useState<'global' | 'job'>('global');
  const [selectedJobKey, setSelectedJobKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Check if we're on a live selling page
  const isLiveSelling = pathname?.includes('/sell/');

  // Auto-select first job and fetch logs when switching to job-specific logs
  useEffect(() => {
    if (selectedLogType === 'job' && availableJobs.length > 0) {
      // If no job is selected or the selected job is no longer available
      if (!selectedJobKey || !availableJobs.includes(selectedJobKey)) {
        const firstJob = availableJobs[0];
        setSelectedJobKey(firstJob);
        fetchLogs('job', firstJob);
      } else {
        // Job is already selected, just fetch the logs
        fetchLogs('job', selectedJobKey);
      }
    }
  }, [selectedLogType, availableJobs]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    setDrawerOpen(false);
  };
  const handleNavigation = (path: string) => {
    router.push(path);
    setDrawerOpen(false);
  };
  const fetchMonitoringStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/background-monitor/status', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setMonitoringStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const handleMonitoringCleanup = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/background-monitor/cleanup', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Refresh status after cleanup
      await fetchMonitoringStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup');
    } finally {
      setLoading(false);
    }
  };
  // Dialog close handler with focus management for accessibility
  const handleMonitoringDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMonitoringDialogOpen(false);
  };
  const handleOpenMonitoringDialog = () => {
    setMonitoringDialogOpen(true);
    fetchMonitoringStatus();
  };  const fetchLogs = async (logType: 'global' | 'job' = selectedLogType, jobKey: string = selectedJobKey) => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/background-monitor/logs?type=' + logType;
      
      if (logType === 'job' && jobKey) {
        const [auctionId, lotId] = jobKey.split('-');
        url += `&auctionId=${auctionId}&lotId=${lotId}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: LogsResponse = await response.json();
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableJobs = async () => {
    try {
      const response = await fetch('/api/background-monitor/logs?type=available', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: AvailableJobsResponse = await response.json();
      setAvailableJobs(data.availableJobs);
      
      // If we don't have a selected job and there are available jobs, select the first one
      if (!selectedJobKey && data.availableJobs.length > 0) {
        setSelectedJobKey(data.availableJobs[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch available jobs:', err);
    }
  };  const handleOpenLogsDialog = () => {
    setLogsDialogOpen(true);
    // Fetch available jobs - the useEffect will handle fetching logs based on selected type
    fetchAvailableJobs();
    // If we're on global logs, fetch them immediately since useEffect only handles job logs
    if (selectedLogType === 'global') {
      fetchLogs('global');
    }
  };

  const handleLogsDialogClose = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLogsDialogOpen(false);
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'error';
      case 'WARN': return 'warning';
      case 'INFO': return 'info';
      case 'DEBUG': return 'default';
      default: return 'default';
    }
  };
  const guestMenuItems = [
    { key: 'login', icon: <LoginIcon />, text: t('auth_login', lang), path: '/login' },
    { key: 'register', icon: <RegisterIcon />, text: t('auth_register', lang), path: '/register' },
  ];  const userMenuItems = [
    { key: 'home', icon: <HomeIcon />, text: t('nav_home', lang), path: '/' },
    { key: 'auctions', icon: <AuctionIcon />, text: t('nav_auctions', lang), path: '/auctions' },
    { key: 'lots', icon: <AuctionIcon />, text: t('nav_lots', lang), path: '/lots' },
    { key: 'profile', icon: <ProfileIcon />, text: t('nav_profile', lang), path: '/profile' },
    { key: 'settings', icon: <SettingsIcon />, text: t('nav_settings', lang), path: '/settings' },
  ];

  const menuItems = user ? userMenuItems : guestMenuItems;

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          {/* Burger Menu */}
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>          {/* App Name with LIVE chip */}
          <Box display="flex" alignItems="center" gap={1} sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              {t('app_name', lang)}
            </Typography>
            {isLiveSelling && (
              <Chip
                icon={<YouTubeIcon />}
                label="LIVE"
                color="error"
                variant="filled"
                size="small"
              />
            )}
          </Box>{/* Controls on the right */}
          <Box display="flex" alignItems="center" gap={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
            {/* Language Switcher */}
            <Button 
              color="inherit" 
              size="small"
              onClick={() => setLanguage(lang === 'en' ? 'uk' : 'en')}
            >
              {lang === 'en' ? 'UA' : 'EN'}
            </Button>

            {/* Theme Switcher */}
            <IconButton 
              color="inherit" 
              onClick={toggleTheme}
              title={t('theme_toggleTheme', lang)}
            >
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>

            {/* User Info & Logout (if logged in) */}
            {user && (
              <>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {t('auth_welcome', lang, { login: user.login })}
                </Typography>
                <IconButton 
                  color="inherit" 
                  onClick={handleLogout}
                  title={t('auth_logout', lang)}
                  sx={{ ml: 1 }}
                >
                  <LogoutIcon />
                </IconButton>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer Menu */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 250 }} role="presentation">
          <List>            {menuItems.map((item) => (
              <ListItemButton key={item.key} onClick={() => handleNavigation(item.path)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            ))}
            
            <Divider sx={{ my: 1 }} />
              {/* Mobile-only controls */}
            <ListItemButton onClick={() => { setLanguage(lang === 'en' ? 'uk' : 'en'); setDrawerOpen(false); }}>
              <ListItemIcon>🌐</ListItemIcon>
              <ListItemText primary={`Language: ${lang === 'en' ? 'English' : 'Українська'}`} />
            </ListItemButton>
            
            <ListItemButton onClick={() => { toggleTheme(); setDrawerOpen(false); }}>
              <ListItemIcon>{mode === 'dark' ? <LightMode /> : <DarkMode />}</ListItemIcon>
              <ListItemText primary={t('theme_toggleTheme', lang)} />
            </ListItemButton>            {/* Monitoring Status (Admin Only) */}
            {user && user.isAdmin && (
              <ListItemButton onClick={() => { handleOpenMonitoringDialog(); setDrawerOpen(false); }}>
                <ListItemIcon><MonitorIcon /></ListItemIcon>
                <ListItemText primary="Background Monitor (Admin)" />
              </ListItemButton>
            )}
            
            {user && (
              <>
                <Divider sx={{ my: 1 }} />
                <ListItemButton onClick={handleLogout}>
                  <ListItemIcon><LogoutIcon /></ListItemIcon>
                  <ListItemText primary={t('auth_logout', lang)} />
                </ListItemButton>
              </>
            )}
          </List>
        </Box>      </Drawer>      {/* Background Monitoring Status Dialog */}
      <Dialog 
        open={monitoringDialogOpen} 
        onClose={handleMonitoringDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <MonitorIcon />
            Background Monitor Status
          </Box>
        </DialogTitle>
        <DialogContent>
          {loading && (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error: {error}
            </Alert>
          )}
          
          {monitoringStatus && (
            <>
              {/* Summary Cards */}
              <Box display="flex" gap={2} mb={3}>
                <Chip 
                  icon={<MonitorIcon />}
                  label={`Active Jobs: ${monitoringStatus.activeJobs}`}
                  color={monitoringStatus.activeJobs > 0 ? "primary" : "default"}
                />
                <Chip 
                  label={`Total: ${monitoringStatus.summary.totalJobs}`}
                  color="secondary"
                />
              </Box>

              {/* Jobs Table */}
              {monitoringStatus.jobs.length > 0 ? (
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Auction ID</TableCell>
                        <TableCell>Lot ID</TableCell>
                        <TableCell>Last Processed</TableCell>
                        <TableCell>Polling Interval</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monitoringStatus.jobs.map((job, index) => (
                        <TableRow key={`${job.auctionId}-${job.lotId}`}>
                          <TableCell>{job.auctionId}</TableCell>
                          <TableCell>{job.lotId}</TableCell>
                          <TableCell>
                            {new Date(job.lastProcessedTime).toLocaleString()}
                          </TableCell>
                          <TableCell>{job.currentPollingInterval}ms</TableCell>
                          <TableCell>
                            <Chip 
                              label={job.isActive ? "Active" : "Inactive"}
                              color={job.isActive ? "success" : "default"}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No active monitoring jobs found.
                </Alert>
              )}

              {/* Jobs by Auction Summary */}
              {Object.keys(monitoringStatus.summary.jobsByAuction).length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Jobs by Auction:</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {Object.entries(monitoringStatus.summary.jobsByAuction).map(([auctionId, count]) => (
                      <Chip 
                        key={auctionId}
                        label={`Auction ${auctionId}: ${count} jobs`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>        <DialogActions>
          <Button 
            onClick={fetchMonitoringStatus}
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button 
            onClick={handleOpenLogsDialog}
            startIcon={<HistoryIcon />}
            color="info"
            disabled={loading}
          >
            View Logs
          </Button>
          <Button 
            onClick={handleMonitoringCleanup}
            startIcon={<CleanupIcon />}
            color="warning"
            disabled={loading}
          >
            Cleanup All
          </Button>
          <Button onClick={() => setMonitoringDialogOpen(false)}>
            Close
          </Button>        </DialogActions>
      </Dialog>

      {/* Background Monitor Logs Dialog */}
      <Dialog 
        open={logsDialogOpen} 
        onClose={handleLogsDialogClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon />
            Background Monitor Logs
          </Box>
        </DialogTitle>        <DialogContent>
          {loading && (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error: {error}
            </Alert>
          )}
          
          {/* Log Type Selector */}
          <Box display="flex" gap={2} mb={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Log Type</InputLabel>
              <Select
                value={selectedLogType}
                label="Log Type"
                onChange={(e) => {
                  setSelectedLogType(e.target.value as 'global' | 'job');
                  fetchLogs(e.target.value as 'global' | 'job', selectedJobKey);
                }}
              >
                <MenuItem value="global">Global Logs</MenuItem>
                <MenuItem value="job">Job-Specific</MenuItem>
              </Select>
            </FormControl>
            
            {selectedLogType === 'job' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Monitor Job</InputLabel>
                <Select
                  value={selectedJobKey}
                  label="Monitor Job"
                  onChange={(e) => {
                    setSelectedJobKey(e.target.value);
                    fetchLogs('job', e.target.value);
                  }}
                  disabled={availableJobs.length === 0}
                >
                  {availableJobs.map((jobKey) => (
                    <MenuItem key={jobKey} value={jobKey}>
                      Auction {jobKey.replace('-', ', Lot ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
          
          {logs.length > 0 ? (
            <TableContainer component={Paper} sx={{ maxHeight: 600, mb: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Auction/Lot</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Metadata</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log, index) => (
                    <TableRow key={index}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={log.level}
                          color={getLogLevelColor(log.level) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {log.auctionId && log.lotId ? `${log.auctionId}-${log.lotId}` : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400, wordBreak: 'break-word' }}>
                        {log.message}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, fontSize: '0.8rem' }}>
                        {log.metadata ? (
                          <pre style={{ margin: 0, fontSize: '0.7rem', overflow: 'auto' }}>
                            {typeof log.metadata === 'string' 
                              ? log.metadata 
                              : JSON.stringify(log.metadata, null, 1)
                            }
                          </pre>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              No log entries found.
            </Alert>
          )}
        </DialogContent>        <DialogActions>
          <Button 
            onClick={() => fetchLogs(selectedLogType, selectedJobKey)}
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            Refresh Logs
          </Button>
          <Button onClick={handleLogsDialogClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
