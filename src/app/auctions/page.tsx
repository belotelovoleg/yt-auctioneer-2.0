"use client";

import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t, Lang } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Event as DateIcon,
  YouTube as YouTubeIcon,
  Timer as TimerIcon,
  Schedule as ScheduledIcon,
  CheckCircle as ReadyIcon,
  PlayCircleFilled as StartedIcon,
  Stop as FinishedIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";

interface Auction {
  id: string;
  name: string;
  description: string;
  date: string;
  youtubeChannelId: string;
  youtubeVideoId?: string;
  useTimer?: boolean;
  status: "SCHEDULED" | "READY" | "STARTED" | "FINISHED";
  userId: string;
}

const statusColors = {
  SCHEDULED: "info",
  READY: "success",
  STARTED: "warning",
  FINISHED: "default",
} as const;

const getStatusTranslation = (status: Auction["status"], lang: Lang) => {
  switch (status) {
    case "SCHEDULED":
      return t("auctionStatus_scheduled", lang);
    case "READY":
      return t("auctionStatus_ready", lang);
    case "STARTED":
      return t("auctionStatus_started", lang);
    case "FINISHED":
      return t("auctionStatus_finished", lang);
    default:
      return status;
  }
};

export default function AuctionsPage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true); // Add this state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [deletingAuction, setDeletingAuction] = useState<Auction | null>(null);
  const [startingAuctionId, setStartingAuctionId] = useState<string | null>(null);  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: "",
    youtubeChannelId: "",
    youtubeVideoId: "",
    useTimer: false, // Default to disabled
    // status is system-managed, not user-editable
  });
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    
    if (user) {
      fetchAuctions();
    }
  }, [user, loading, router]);

  const fetchAuctions = async () => {
    try {
      setLoadingAuctions(true); // Set loading to true when starting fetch
      const response = await fetch("/api/auctions");
      if (response.ok) {
        const data = await response.json();
        setAuctions(data);
      }
    } catch (error) {
      console.error("Failed to fetch auctions:", error);
    } finally {
      setLoadingAuctions(false); // Always set loading to false when done
    }
  };  const handleDialogOpen = async (auction?: Auction) => {
    if (auction) {
      setEditingAuction(auction);
      
      // Convert the date to the proper format for datetime-local input
      const dateForInput = auction.date ? new Date(auction.date).toISOString().slice(0, 16) : "";
      
      setFormData({
        name: auction.name,
        description: auction.description,
        date: dateForInput, // Fixed date formatting
        youtubeChannelId: auction.youtubeChannelId,
        youtubeVideoId: auction.youtubeVideoId || "",
        useTimer: auction.useTimer !== undefined ? auction.useTimer : true,
      });
    } else {
      setEditingAuction(null);
      
      // For new auctions, try to get user's default YouTube channel ID
      let defaultChannelId = "";
      try {
        const profileResponse = await fetch("/api/users/profile");
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          defaultChannelId = profile.youtubeChannelId || "";
        }
      } catch (error) {
        console.log("Could not fetch user profile for default values:", error);
      }
        setFormData({        name: "",
        description: "",
        date: "",
        youtubeChannelId: defaultChannelId,
        youtubeVideoId: "",
        useTimer: false, // Default to disabled
        // status defaults to SCHEDULED, handled by API
      });
    }
    setDialogOpen(true);
  };
  const handleDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDialogOpen(false);
    setEditingAuction(null);
  };
  const handleSave = async () => {
    try {      // Client-side validation
      if (!formData.name.trim()) {
        setAlertMessage({
          type: "error",
          message: t("auction_nameRequired", lang),
        });
        return;
      }

      if (!formData.youtubeChannelId.trim() && !formData.youtubeVideoId.trim()) {
        setAlertMessage({
          type: "error",
          message: t("auction_youtubeRequired", lang),
        });
        return;
      }

      const url = editingAuction ? `/api/auctions/${editingAuction.id}` : "/api/auctions";
      const method = editingAuction ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });if (response.ok) {
        setAlertMessage({
          type: "success",
          message: editingAuction ? t("auction_updated", lang) : t("auction_created", lang),
        });
        handleDialogClose();
        fetchAuctions();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("API Error:", response.status, errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }    } catch (error) {
      console.error("Save error:", error);
      setAlertMessage({
        type: "error",
        message: error instanceof Error ? error.message : t("auction_saveError", lang),
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAuction) return;

    try {
      const response = await fetch(`/api/auctions/${deletingAuction.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAlertMessage({
          type: "success",
          message: t("auction_deleted", lang),
        });
        fetchAuctions();
      } else {
        throw new Error("Failed to delete auction");
      }    } catch (error) {
      setAlertMessage({
        type: "error",
        message: t("auction_deleteError", lang),
      });
    } finally {
      handleDeleteDialogClose();
    }
  };
  const handleDeleteClick = (auction: Auction) => {
    setDeletingAuction(auction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDeleteDialogOpen(false);
    setDeletingAuction(null);
  };
  const handleStartAuction = async (auctionId: string) => {
    setStartingAuctionId(auctionId);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAlertMessage({
          type: "success",
          message: t("auction_started", lang),
        });        fetchAuctions(); // Refresh to show updated status
        // Redirect to the lot selection page for live selling
        router.push(`/auctions/${auctionId}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start auction");
      }
    } catch (error) {
      console.error("Error starting auction:", error);
      setAlertMessage({
        type: "error",
        message: error instanceof Error ? error.message : t("auction_startError", lang),
      });
    } finally {
      setStartingAuctionId(null);
    }
  };

  if (loading || !user) return null;

  return (
    <Box sx={{ p: 3 }}>
      {/* Alert */}
      {alertMessage && (
        <Alert 
          severity={alertMessage.type} 
          sx={{ mb: 2 }}
          onClose={() => setAlertMessage(null)}
        >
          {alertMessage.message}
        </Alert>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {t("nav_auctions", lang)}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleDialogOpen()}
        >
          {t("auction_createAuction", lang)}
        </Button>
      </Box>      {/* Auctions Grid */}
      <Box sx={{ 
  display: 'grid', 
  gridTemplateColumns: { 
    xs: '1fr', 
    sm: 'repeat(2, 1fr)', 
    md: 'repeat(3, 1fr)' 
  }, 
  gap: { xs: 2, sm: 3 }
}}>
        {auctions.map((auction) => (
          <Card 
            key={auction.id}
            sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              '&:hover': {
                elevation: 4,
                transform: 'translateY(-2px)',
                transition: 'all 0.2s ease-in-out'
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 } }}>
              {/* Header with Title and Status */}
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Typography 
                  variant="h6" 
                  component="h2" 
                  sx={{ 
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    fontWeight: 600,
                    flex: 1,
                    mr: 1,
                    lineHeight: 1.2
                  }}
                >
                  {auction.name}
                </Typography>
                
                <Tooltip title={getStatusTranslation(auction.status, lang)}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: '50%',
                      bgcolor: 
                        auction.status === 'READY' ? 'success.main' :
                        auction.status === 'STARTED' ? 'warning.main' :
                        auction.status === 'FINISHED' ? 'error.main' :
                        'info.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 32,
                      minHeight: 32
                    }}
                  >
                    {auction.status === 'SCHEDULED' && <ScheduledIcon sx={{ fontSize: '1.2rem' }} />}
                    {auction.status === 'READY' && <ReadyIcon sx={{ fontSize: '1.2rem' }} />}
                    {auction.status === 'STARTED' && <StartedIcon sx={{ fontSize: '1.2rem' }} />}
                    {auction.status === 'FINISHED' && <FinishedIcon sx={{ fontSize: '1.2rem' }} />}
                  </Box>
                </Tooltip>
              </Box>
              
              {/* Description */}
              {auction.description && (
                <Box display="flex" alignItems="flex-start" mb={2}>
                  <DescriptionIcon sx={{ fontSize: '1rem', color: 'text.secondary', mr: 1, mt: 0.2 }} />
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.875rem', sm: '0.875rem' },
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {auction.description}
                  </Typography>
                </Box>
              )}
              
              {/* Date */}
              <Box display="flex" alignItems="center" mb={1.5}>
                <DateIcon sx={{ fontSize: '1rem', color: 'text.secondary', mr: 1 }} />
                <Typography 
                  variant="body2" 
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {new Date(auction.date).toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-US')}
                </Typography>
              </Box>
              
              {/* YouTube Channel */}
              <Box display="flex" alignItems="center" mb={1.5}>
                <YouTubeIcon sx={{ fontSize: '1rem', color: 'text.secondary', mr: 1 }} />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {auction.youtubeChannelId}
                </Typography>
              </Box>
              
              {/* Timer Setting */}
              <Box display="flex" alignItems="center" mb={2}>
                <TimerIcon sx={{ fontSize: '1rem', color: 'text.secondary', mr: 1 }} />
                <Typography 
                  variant="body2" 
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {auction.useTimer ? t("auction_useTimer", lang) : t("liveSelling_disableTimer", lang)}
                </Typography>
                <Chip
                  label={auction.useTimer ? "ON" : "OFF"}
                  size="small"
                  color={auction.useTimer ? "success" : "default"}
                  sx={{ ml: 1, fontSize: '0.7rem', height: 20 }}
                />
              </Box>
            </CardContent>
            
            {/* Actions */}
            <CardActions sx={{ p: { xs: 1.5, sm: 2 }, pt: 0 }}>
              <Box 
                display="flex" 
                width="100%" 
                gap={1}
                sx={{
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' }
                }}
              >
                {/* Action Icons */}
                <Box display="flex" gap={0.5}>
                  <Tooltip title={t("auction_edit", lang)}>
                    <IconButton 
                      size="small"
                      onClick={() => handleDialogOpen(auction)}
                      sx={{ color: 'primary.main' }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title={t("auction_delete", lang)}>
                    <IconButton 
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(auction)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                  
                  {/* Start Auction Button - only show for SCHEDULED auctions */}
                  {auction.status === "SCHEDULED" && (
                    <Tooltip title={t("auction_start", lang)}>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleStartAuction(auction.id)}
                        disabled={startingAuctionId === auction.id}
                      >
                        {startingAuctionId === auction.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <StartIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                
                {/* Main Action Buttons */}
                <Box 
                  display="flex" 
                  gap={1} 
                  sx={{ 
                    flex: 1,
                    justifyContent: { xs: 'stretch', sm: 'flex-end' },
                    '& > button': { 
                      fontSize: { xs: '0.75rem', sm: '0.8rem' },
                      py: { xs: 0.5, sm: 0.75 }
                    }
                  }}
                >                  {/* Go to Live Auction Button - only show for READY and STARTED auctions */}
                  {(auction.status === "READY" || auction.status === "STARTED") && (
                    <Button 
                      size="small" 
                      variant="contained"
                      color="primary"
                      onClick={() => router.push(`/auctions/${auction.id}`)}
                      sx={{ minWidth: { xs: 'auto', sm: 'auto' } }}
                    >
                      {t("auction_goToLive", lang)}
                    </Button>
                  )}

                  {/* Conditional button based on auction status */}
                  {auction.status === "FINISHED" ? (
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => router.push(`/auctions/${auction.id}/results`)}
                      sx={{ minWidth: { xs: 'auto', sm: 'auto' } }}
                    >
                      {t("auction_auctionResults", lang)}
                    </Button>
                  ) : (
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => router.push(`/auctions/${auction.id}/lots`)}
                      sx={{ minWidth: { xs: 'auto', sm: 'auto' } }}
                    >
                      {t("auctionLots_manageLots", lang)}
                    </Button>
                  )}
                </Box>
              </Box>
            </CardActions>
          </Card>
        ))}
      </Box>
      
      {loadingAuctions ? (
        <Box textAlign="center" py={4}>
          <CircularProgress />          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t("auction_loadingText", lang)}
          </Typography>
        </Box>      ) : auctions.length === 0 ? (        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">
            {t("auction_noAuctionsTitle", lang)}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("auction_noAuctionsDescription", lang)}
          </Typography>
        </Box>
      ) : null}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAuction ? t("auction_editAuction", lang) : t("auction_createAuction", lang)}
        </DialogTitle>        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t("auction_name", lang)}
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            autoComplete="off"
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label={t("auction_description", lang)}
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
          />
            <TextField
            margin="dense"
            label={t("auction_date", lang)}
            type="datetime-local"
            fullWidth
            variant="outlined"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}            InputLabelProps={{ shrink: true }}
            helperText={t("auction_helperDate", lang)}
            sx={{ mb: 2 }}
          />          <TextField
            margin="dense"
            label={t("auction_youtubeChannelId", lang)}
            fullWidth
            variant="outlined"
            value={formData.youtubeChannelId}            onChange={(e) => setFormData({ ...formData, youtubeChannelId: e.target.value })}
            helperText={t("auction_helperChannelId", lang)}
            sx={{ mb: 2 }}
          />          <TextField
            margin="dense"
            label={t("auction_youtubeVideoId", lang)}
            fullWidth
            variant="outlined"
            value={formData.youtubeVideoId}            onChange={(e) => setFormData({ ...formData, youtubeVideoId: e.target.value })}
            helperText={t("auction_helperVideoId", lang)}
            sx={{ mb: 2 }}
          />
            {/* Timer Control Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.useTimer}
                onChange={(e) => setFormData({ ...formData, useTimer: e.target.checked })}
                color="primary"
              />
            }
            label={t("auction_useTimer", lang)}
            sx={{ mb: 2 }}
          />
          
          {/* Status is system-managed and not user-editable */}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>
            {t("auction_cancel", lang)}
          </Button>
          <Button onClick={handleSave} variant="contained">
            {t("auction_save", lang)}
          </Button>
        </DialogActions>
      </Dialog>      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteDialogClose}>
        <DialogTitle>{t("auction_deleteAuction", lang)}</DialogTitle>
        <DialogContent>
          <Typography>
            {t("auction_confirmDelete", lang)}
          </Typography>
          {deletingAuction && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              "{deletingAuction.name}"
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDialogClose}>
            {t("auction_cancel", lang)}
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            {t("auction_delete", lang)}
          </Button>        </DialogActions>
      </Dialog>
    </Box>
  );
}
