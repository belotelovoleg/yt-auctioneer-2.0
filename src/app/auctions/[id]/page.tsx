"use client";

import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t, Lang } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  IconButton,
  Avatar,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as StartSellingIcon,
  LocalOffer as DiscountIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduledIcon,
  CheckCircle as ReadyIcon,
  PlayCircleFilled as StartedIcon,
  Stop as FinishedIcon,
  Sell as PriceIcon,
  TrendingUp as StepIcon,
  Timer as TimerIcon,
  Discount as DiscountChipIcon,
} from "@mui/icons-material";

interface Lot {
  id: number;
  name: string;
  description: string;
  photo?: string;
  startingPrice: number;
  priceStep: number;
  timer: number;
  discount: number;
  useTimer: boolean;
  calculatedPrice: number;
  status?: string; // Add status field to track lot state
  finalPrice?: number; // Add finalPrice field for sold lots
}

interface AuctionLot {
  id: number;
  order: number;
  lot: Lot;
}

interface Auction {
  id: number;
  name: string;
  status: string;
  youtubeVideoId?: string;
  youtubeChannelId?: string;
  discountPool: number;
  discountUsed: number;
  auctionLots: AuctionLot[];
}

export default function LiveAuctionPage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const auctionId = parseInt(params.id as string);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  // Discount pool management state
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountViewDialogOpen, setDiscountViewDialogOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [discountAccordionExpanded, setDiscountAccordionExpanded] = useState(false);  // Add useState for the search filter
  const [searchFilter, setSearchFilter] = useState<string>('');
  // Track which lot is currently being sold
  const [currentlySellingLotId, setCurrentlySellingLotId] = useState<number | null>(null);
  // Finish auction dialog state
  const [finishAuctionDialogOpen, setFinishAuctionDialogOpen] = useState(false);
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    
    if (user) {
      fetchAuction();
    }
  }, [user, loading, router, auctionId]);

  // Refresh auction data when page comes back into focus (when returning from selling page)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchAuction();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // Auto-expand discount accordion if pool is already set
  useEffect(() => {
    if (auction && auction.discountPool > 0) {
      setDiscountAccordionExpanded(true);
    }
  }, [auction]);const fetchAuction = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      // Add cache busting to ensure fresh data
      const response = await fetch(`/api/auctions/${auctionId}/lots?t=${Date.now()}`);      if (response.ok) {
        const data = await response.json();
        setAuction(data);
        setDiscountAmount(data.discountPool.toString() || '0');

        // Find which lot is currently being sold
        const sellingLot = data.auctionLots?.find((auctionLot: AuctionLot) => 
          auctionLot.lot.status === 'BEING_SOLD'
        );
        setCurrentlySellingLotId(sellingLot ? sellingLot.lot.id : null);
          // Check if auction is in the right status
        if (data.status !== 'READY' && data.status !== 'STARTED') {
          // If we came from "Start Auction" and status is still SCHEDULED, retry a few times
          // to handle race condition where DB hasn't updated yet
          if (data.status === 'SCHEDULED' && retryCount < 3) {
            setTimeout(() => {
              fetchAuction(retryCount + 1);
            }, 1000); // Wait 1 second before retry
            return;
          }
          setAlertMessage({
            type: "warning",
            message: t("lotSelection_auctionNotReady", lang),
          });
        } else {
          // Clear any previous warning if status is now correct
          setAlertMessage(null);
        }
      } else if (response.status === 404) {        setAlertMessage({
          type: "error",
          message: t("lotSelection_auctionNotFound", lang),
        });
        router.push("/auctions");
      }
    } catch (error) {
      console.error("Failed to fetch auction:", error);      setAlertMessage({
        type: "error",
        message: t("lotSelection_auctionNotFound", lang),
      });
    } finally {
      setIsLoading(false);
    }
  };  // Dialog close handlers with focus management for accessibility
  const handleDiscountDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDiscountDialogOpen(false);
  };

  const handleDiscountViewDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDiscountViewDialogOpen(false);
  };

  const handleStartSelling = (lot: Lot) => {
    // Navigate to the live selling page for this specific lot
    router.push(`/auctions/${auctionId}/sell/${lot.id}`);
  };

  const handleDiscountPoolUpdate = async () => {
    const amount = parseFloat(discountAmount);
    if (isNaN(amount) || amount < 0) {      setAlertMessage({
        type: "error",
        message: t("lotSelection_invalidAmount", lang),
      });
      return;
    }

    try {
      const response = await fetch(`/api/auctions/${auctionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discountPool: amount
        }),
      });

      if (response.ok) {        const updatedAuction = await response.json();
        setAuction(updatedAuction);
        handleDiscountDialogClose();        setAlertMessage({
          type: "success",
          message: t("lotSelection_poolUpdated", lang, { amount: amount.toString() }),
        });
      } else {
        throw new Error('Failed to update discount pool');
      }
    } catch (error) {
      console.error('Error updating discount pool:', error);      setAlertMessage({
        type: "error",
        message: t("lotSelection_failedToUpdatePool", lang),
      });    }
  };  const handleFinishAuction = async () => {
    setFinishAuctionDialogOpen(true);
  };

  const handleFinishAuctionConfirm = async () => {
    setFinishAuctionDialogOpen(false);

    try {
      const response = await fetch(`/api/auctions/${auctionId}/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();        setAlertMessage({
          type: "success",
          message: t('auction_finished', lang),
        });
        // Refresh auction data to show new status
        await fetchAuction();
      } else {
        const error = await response.json();
        throw new Error(error.error || t('auction_finishError', lang));
      }
    } catch (error) {
      console.error('Error finishing auction:', error);
      setAlertMessage({
        type: "error",
        message: error instanceof Error ? error.message : t('auction_finishError', lang),
      });
    }
  };

  // Filter the lots based on the search term
  const filteredLots = auction?.auctionLots?.filter(auctionLot =>
    auctionLot.lot.name.toLowerCase().includes(searchFilter.toLowerCase())
  ) || [];

  if (loading || !user || isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!auction) {
    return (      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t("lotSelection_auctionNotFound", lang)}</Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Alert */}
      {alertMessage && (        <Alert 
          severity={alertMessage.type} 
          sx={{ mb: 2 }}
          onClose={() => setAlertMessage(null)}
        >
          {alertMessage.type === 'warning' ? t('lotSelection_auctionNotReady', lang) : alertMessage.message}
        </Alert>
      )}      {/* Header */}
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="space-between"
        mb={3}
        sx={{ position: 'relative' }}
      >
        {/* Back Button - Left */}
        <IconButton onClick={() => router.back()}>
          <ArrowBackIcon />
        </IconButton>
        
        {/* Title - Center */}
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontSize: { xs: '1rem', sm: '1.3rem' },
            textAlign: 'center',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: { xs: 'calc(100% - 120px)', sm: 'calc(100% - 120px)' },
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2, // Allow up to 2 lines
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.2,
            maxHeight: { xs: '2.4rem', sm: '3rem' }, // Height for 2 lines
            wordBreak: 'break-word', // Help with long words
          }}
        >
          {t('lotSelection_title', lang)}: {auction.name}
        </Typography>
        
        {/* Status Button - Right */}        <Tooltip 
          title={`${t('auction_status', lang)}: ${
            auction.status === 'SCHEDULED' ? t('auctionStatus_scheduled', lang) :
            auction.status === 'READY' ? t('auctionStatus_ready', lang) :
            auction.status === 'STARTED' ? t('auctionStatus_started', lang) :
            auction.status === 'FINISHED' ? t('auctionStatus_finished', lang) :
            auction.status
          }`}
        >
          <IconButton
            sx={{
              bgcolor: 
                auction.status === 'READY' ? 'success.main' :
                auction.status === 'STARTED' ? 'warning.main' :
                auction.status === 'FINISHED' ? 'error.main' :
                'grey.500',
              color: 'white',
              '&:hover': {
                bgcolor: 
                  auction.status === 'READY' ? 'success.dark' :
                  auction.status === 'STARTED' ? 'warning.dark' :
                  auction.status === 'FINISHED' ? 'error.dark' :
                  'grey.600',
              }
            }}
          >
            {auction.status === 'SCHEDULED' && <ScheduledIcon />}
            {auction.status === 'READY' && <ReadyIcon />}
            {auction.status === 'STARTED' && <StartedIcon />}
            {auction.status === 'FINISHED' && <FinishedIcon />}
            {!['SCHEDULED', 'READY', 'STARTED', 'FINISHED'].includes(auction.status) && <ScheduledIcon />}
          </IconButton>
        </Tooltip>      </Box>      {/* Discount Pool Management - Hidden Section with Animation */}
      <Box
        sx={{
          mb: 3,
          overflow: 'hidden',
          transition: 'all 0.4s ease-in-out',
          maxHeight: discountAccordionExpanded ? '500px' : '0px',
          opacity: discountAccordionExpanded ? 1 : 0,
          transform: discountAccordionExpanded ? 'translateY(0)' : 'translateY(-10px)',
        }}
      >
        <Box sx={{ 
          p: 2, 
          border: 1, 
          borderColor: 'divider', 
          borderRadius: 1, 
          bgcolor: 'background.paper',
          transform: 'translateZ(0)', // Force hardware acceleration
        }}>
          <Typography variant="h6" component="h2" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, mb: 2 }}>
            {t("lotSelection_discountPoolManagement", lang)}
          </Typography>
          
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="space-between" 
            mb={2}
            sx={{
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: { xs: 2, sm: 1 }
            }}
          >
            <Box 
              display="flex" 
              gap={1}
              sx={{
                flexDirection: { xs: 'column', sm: 'row' },
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              <Button
                variant="outlined"
                startIcon={<DiscountIcon />}
                onClick={() => setDiscountDialogOpen(true)}
                size="small"
                sx={{ 
                  width: { xs: '100%', sm: 'auto' },
                  fontSize: '0.75rem',
                  py: 0.5
                }}
              >
                {t("lotSelection_setPool", lang)}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ViewIcon />}
                onClick={() => setDiscountViewDialogOpen(true)}
                size="small"
                sx={{ 
                  width: { xs: '100%', sm: 'auto' },
                  fontSize: '0.75rem',
                  py: 0.5
                }}
              >
                {t("lotSelection_viewUsage", lang)}
              </Button>
            </Box>
          </Box>
          
          <Box 
            display="flex" 
            gap={2}
            sx={{
              flexDirection: 'row',
              gap: { xs: 1, sm: 2 },
              justifyContent: 'space-around'
            }}
          >            <Box 
              sx={{ 
                textAlign: 'center', 
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: { xs: 1, sm: 1.5 },
                bgcolor: 'background.paper'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {t("lotSelection_totalPool", lang)}
              </Typography>
              <Typography variant="h6" color="primary.main" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                {auction?.discountPool || 0}
              </Typography>
            </Box>
            
            <Box 
              sx={{ 
                textAlign: 'center', 
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: { xs: 1, sm: 1.5 },
                bgcolor: 'background.paper'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {t("lotSelection_used", lang)}
              </Typography>
              <Typography variant="h6" color="error.main" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                {auction?.discountUsed || 0}
              </Typography>
            </Box>
            
            <Box 
              sx={{ 
                textAlign: 'center', 
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: { xs: 1, sm: 1.5 },
                bgcolor: 'background.paper'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {t("lotSelection_available", lang)}
              </Typography>
              <Typography variant="h6" color="success.main" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                {(auction?.discountPool || 0) - (auction?.discountUsed || 0)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>{/* Instructions */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {t('lotSelection_instructions', lang)}
        </Typography>
          {/* Discount, Search, and Finish Auction Button Row */}
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 }, 
          alignItems: 'center',
          flexDirection: 'row',
          mb: 2,
          width: '100%'
        }}>          {/* Discount Pool Button */}
          <Tooltip title={t('lotSelection_discountButton', lang)}>
            <Box sx={{ position: 'relative' }}>
              {/* Mobile: Icon Button */}
              <IconButton
                color={discountAccordionExpanded ? "primary" : "default"}
                onClick={() => setDiscountAccordionExpanded(!discountAccordionExpanded)}
                sx={{
                  display: { xs: 'flex', sm: 'none' },
                  border: discountAccordionExpanded ? 'none' : '1px solid',
                  borderColor: 'divider',
                  bgcolor: discountAccordionExpanded ? 'primary.main' : 'transparent',
                  color: discountAccordionExpanded ? 'white' : 'inherit',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 2,
                  },
                  ...(discountAccordionExpanded && {
                    '& .MuiSvgIcon-root': {
                      transform: 'rotate(180deg)',
                      transition: 'transform 0.3s ease-in-out'
                    }
                  })
                }}
              >
                <DiscountIcon />
              </IconButton>
              
              {/* Desktop: Full Button */}
              <Button
                variant={discountAccordionExpanded ? "contained" : "outlined"}
                color={discountAccordionExpanded ? "primary" : "inherit"}
                startIcon={<DiscountIcon />}
                onClick={() => setDiscountAccordionExpanded(!discountAccordionExpanded)}
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  py: 1.5,
                  px: 3,
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  minWidth: '150px',
                  flexShrink: 0,
                  position: 'relative',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: discountAccordionExpanded ? 4 : 2,
                  },
                  ...(discountAccordionExpanded && {
                    boxShadow: 2,
                    '& .MuiButton-startIcon': {
                      transform: 'rotate(180deg)',
                      transition: 'transform 0.3s ease-in-out'
                    }
                  })
                }}
              >
                {t('lotSelection_discountButton', lang)}                {auction?.discountPool > 0 && (
                  <Chip
                    label={`${(auction?.discountPool || 0) - (auction?.discountUsed || 0)}`}
                    size="small"
                    color={discountAccordionExpanded ? "secondary" : "primary"}
                    variant={discountAccordionExpanded ? "filled" : "outlined"}
                    sx={{
                      ml: 1,
                      height: 20,
                      fontSize: '0.75rem',
                      transition: 'all 0.3s ease-in-out'
                    }}
                  />
                )}
              </Button>
                {/* Mobile: Available Count Badge */}
              {auction?.discountPool > 0 && (
                <Chip
                  label={`${(auction?.discountPool || 0) - (auction?.discountUsed || 0)}`}
                  size="small"
                  color={discountAccordionExpanded ? "secondary" : "primary"}
                  variant="filled"
                  sx={{
                    display: { xs: 'flex', sm: 'none' },
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    height: 18,
                    fontSize: '0.7rem',
                    minWidth: 18,
                    transition: 'all 0.3s ease-in-out'
                  }}
                />
              )}
            </Box>
          </Tooltip>          
          {/* Search Field */}
          <TextField
            variant="outlined"
            placeholder={t('auctionLots_searchLots', lang)}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            sx={{ 
              flex: 1,
              width: '100%'
            }}
            InputProps={{
              sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
            }}
          />
          
          {/* Finish Auction Button - only show for READY or STARTED auctions */}
          {(auction.status === 'READY' || auction.status === 'STARTED') && (
            <Tooltip title={t('auction_finish', lang)}>
              <Box>
                {/* Mobile: Icon Button */}
                <IconButton
                  color="error"
                  onClick={handleFinishAuction}
                  sx={{
                    display: { xs: 'flex', sm: 'none' },
                    bgcolor: 'error.main',
                    color: 'white',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      bgcolor: 'error.dark',
                      transform: 'translateY(-1px)',
                      boxShadow: 2,
                    }
                  }}
                >
                  <FinishedIcon />
                </IconButton>
                
                {/* Desktop: Full Button */}
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<FinishedIcon />}
                  onClick={handleFinishAuction}
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    py: 1.5,
                    px: 3,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    minWidth: '150px',
                    flexShrink: 0
                  }}
                >
                  {t('auction_finish', lang)}
                </Button>
              </Box>
            </Tooltip>
          )}
          
          {/* Results Button - only show for FINISHED auctions */}
          {auction.status === 'FINISHED' && (
            <Tooltip title={t('auction_viewResults', lang)}>
              <Box>
                {/* Mobile: Icon Button */}
                <IconButton
                  color="primary"
                  onClick={() => router.push(`/auctions/${auctionId}/results`)}
                  sx={{
                    display: { xs: 'flex', sm: 'none' },
                    bgcolor: 'primary.main',
                    color: 'white',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      transform: 'translateY(-1px)',
                      boxShadow: 2,
                    }
                  }}
                >
                  <ViewIcon />
                </IconButton>
                
                {/* Desktop: Full Button */}
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<ViewIcon />}
                  onClick={() => router.push(`/auctions/${auctionId}/results`)}
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    py: 1.5,
                    px: 3,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    minWidth: '150px',
                    flexShrink: 0
                  }}
                >
                  {t('auction_viewResults', lang)}
                </Button>
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Lots Grid */}
      {filteredLots.length > 0 ? (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            md: 'repeat(3, 1fr)' 
          }, 
          gap: { xs: 2, sm: 3 }
        }}>
          {filteredLots
            .sort((a, b) => a.order - b.order)
            .map((auctionLot, index) => (
            <Card 
              key={auctionLot.id}
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                position: 'relative',
                '&:hover': {
                  elevation: 4,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
            >                {/* Order Badge */}
                <Chip
                  label={`#${auction.auctionLots.findIndex(al => al.id === auctionLot.id) + 1}`}
                  size="small"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 1,
                  }}
                />
                  {/* Currently Selling Badge */}
                {auctionLot.lot.status === 'BEING_SOLD' && (
                  <Chip
                    label="🔴 SELLING"
                    size="small"
                    color="error"
                    variant="filled"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      fontWeight: 'bold',
                      animation: 'pulse 2s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.7 },
                        '100%': { opacity: 1 }
                      }
                    }}
                  />
                )}

                {/* SOLD Badge */}
                {auctionLot.lot.status === 'SOLD' && (
                  <Chip
                    label="✅ SOLD"
                    size="small"
                    color="success"
                    variant="filled"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      fontWeight: 'bold',
                    }}
                  />
                )}
                
                {auctionLot.lot.photo && (
                  <Box
                    sx={{
                      height: { xs: 150, sm: 200 },
                      backgroundImage: `url(${auctionLot.lot.photo})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                )}
                
                <CardContent sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2 } }}>                  <Typography 
                    variant="h6" 
                    component="h3" 
                    gutterBottom
                    sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
                  >
                    {auctionLot.lot.name}
                  </Typography>
                  
                  {auctionLot.lot.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      gutterBottom
                      sx={{ 
                        fontSize: { xs: '0.875rem', sm: '0.875rem' },
                        lineHeight: 1.4
                      }}
                    >
                      {auctionLot.lot.description}
                    </Typography>                  )}
                    
                    <Box sx={{ 
                      display: 'flex', 
                      gap: { xs: 0.5, sm: 1 }, 
                      mb: 2, 
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'center', sm: 'flex-start' }
                    }}>
                      <Tooltip title={t("lot_startingPrice", lang)}>
                        <Chip
                          icon={<PriceIcon sx={{ fontSize: '1rem !important' }} />}
                          label={auctionLot.lot.startingPrice}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                        />
                      </Tooltip>
                      
                      <Tooltip title={t("lot_priceStep", lang)}>
                        <Chip
                          icon={<StepIcon sx={{ fontSize: '1rem !important' }} />}
                          label={auctionLot.lot.priceStep}
                          size="small"
                          variant="outlined"
                          color="secondary"
                          sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                        />
                      </Tooltip>
                      
                      <Tooltip title={t("lot_timer", lang)}>
                        <Chip
                          icon={<TimerIcon sx={{ fontSize: '1rem !important' }} />}
                          label={`${auctionLot.lot.timer}s`}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                        />
                      </Tooltip>                        {auctionLot.lot.discount > 0 && (
                        <Tooltip title={t("lot_discount", lang)}>
                          <Chip
                            icon={<DiscountChipIcon sx={{ fontSize: '1rem !important' }} />}
                            label={auctionLot.lot.discount}
                            size="small"
                            color="error"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                          />
                        </Tooltip>
                      )}
                        {/* Show final price for SOLD lots */}
                      {auctionLot.lot.status === 'SOLD' && auctionLot.lot.finalPrice ? (
                        <Tooltip title="Final Price">
                          <Chip
                            icon={<PriceIcon sx={{ fontSize: '1rem !important' }} />}
                            label={`SOLD: ${auctionLot.lot.finalPrice}`}
                            size="small"
                            variant="filled"
                            color="success"
                            sx={{ 
                              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                              fontWeight: 'bold'
                            }}
                          />
                        </Tooltip>
                      ) : (
                        /* Show calculated price for non-SOLD lots */
                        (auctionLot.lot.discount > 0 && auctionLot.lot.calculatedPrice !== auctionLot.lot.startingPrice) && (
                          <Tooltip title={t("lot_calculatedPrice", lang)}>
                            <Chip
                              icon={<PriceIcon sx={{ fontSize: '1rem !important' }} />}
                              label={auctionLot.lot.calculatedPrice}
                              size="small"
                              variant="filled"
                              color="success"
                              sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                            />
                          </Tooltip>
                        )
                      )}                    </Box>
                      {/* Only show selling button for non-SOLD lots */}
                      {auctionLot.lot.status !== 'SOLD' && (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<StartSellingIcon />}
                          onClick={() => handleStartSelling(auctionLot.lot)}
                          disabled={
                            (auction.status !== 'READY' && auction.status !== 'STARTED') ||
                            (currentlySellingLotId !== null && currentlySellingLotId !== auctionLot.lot.id)
                          }
                          color={auctionLot.lot.status === 'BEING_SOLD' ? 'success' : 'primary'}
                          sx={{ 
                            mt: 1,
                            py: { xs: 1, sm: 1.5 },
                            fontSize: { xs: '0.875rem', sm: '0.875rem' }
                          }}
                        >
                          {auctionLot.lot.status === 'BEING_SOLD' 
                            ? t('liveSelling_continueSelling', lang)
                            : t('liveSelling_startSelling', lang)
                          }
                        </Button>
                      )}
                      
                      {/* Show SOLD message for sold lots */}
                      {auctionLot.lot.status === 'SOLD' && (
                        <Box 
                          sx={{ 
                            mt: 1,
                            py: { xs: 1, sm: 1.5 },
                            textAlign: 'center',
                            bgcolor: 'success.light',
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'success.main'
                          }}
                        >
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: 'success.dark',
                              fontSize: { xs: '0.875rem', sm: '1rem' }
                            }}
                          >
                            ✅ {t('liveSelling_sold', lang)}
                          </Typography>
                          {auctionLot.lot.finalPrice && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'success.dark',
                                fontSize: { xs: '0.75rem', sm: '0.875rem' }
                              }}
                            >
                              {t('liveSelling_for', lang)} {auctionLot.lot.finalPrice}
                            </Typography>
                          )}
                        </Box>
                      )}</CardContent>
              </Card>
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          {searchFilter ? (
            <>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No lots found matching "{searchFilter}"
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Try adjusting your search term
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setSearchFilter('')}
              >
                Clear Search
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('lotSelection_noLotsTitle', lang)}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {t('lotSelection_noLotsDescription', lang)}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => router.push(`/auctions/${auctionId}/lots`)}
              >
                {t('auctionLots_manageLots', lang)}
              </Button>
            </>
          )}
        </Box>
      )}      {/* Discount Pool Dialog */}
      <Dialog 
        open={discountDialogOpen} 
        onClose={handleDiscountDialogClose}
        fullWidth
        maxWidth="sm"
        disableScrollLock={true} // Add this to prevent body padding changes
        PaperProps={{
          sx: { 
            m: { xs: 2, sm: 3 },
            width: { xs: 'calc(100vw - 32px)', sm: 'auto' }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>{t("lotSelection_setDiscountPool", lang)}</DialogTitle>        <DialogContent sx={{ pb: 1 }}>
          <TextField
            autoFocus
            margin="dense"
            label={t("lotSelection_discountPoolAmount", lang)}
            type="number"
            fullWidth
            variant="outlined"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            sx={{ mt: 2 }}
            helperText={t("lotSelection_discountPoolHelper", lang)}
            autoComplete="off"
          />
        </DialogContent>        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleDiscountDialogClose}
            sx={{ minWidth: { xs: 80, sm: 'auto' } }}
          >
            {t("lotSelection_cancel", lang)}
          </Button>
          <Button 
            onClick={handleDiscountPoolUpdate} 
            variant="contained"
            sx={{ minWidth: { xs: 100, sm: 'auto' } }}
          >
            {t("lotSelection_setPoolButton", lang)}
          </Button>
        </DialogActions>
      </Dialog>      {/* Discount Usage View Dialog */}
      <Dialog 
        open={discountViewDialogOpen} 
        onClose={handleDiscountViewDialogClose} 
        maxWidth="md" 
        fullWidth
        disableScrollLock={true} // Add this to prevent body padding changes
        PaperProps={{
          sx: { 
            m: { xs: 1, sm: 3 },
            width: { xs: 'calc(100vw - 16px)', sm: 'auto' },
            maxHeight: { xs: 'calc(100vh - 32px)', sm: 'auto' }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          {t("lotSelection_discountUsageOverview", lang)}
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              {t("lotSelection_poolSummary", lang)}
            </Typography>            <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
              <Box 
                display="flex" 
                justifyContent="space-between"
                sx={{
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: { xs: 2, sm: 0 }
                }}
              >                <Box textAlign="center">
                  <Typography 
                    variant="subtitle2" 
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    {t("lotSelection_totalPool", lang)}
                  </Typography>
                  <Typography 
                    variant="h5" 
                    color="primary.main"
                    sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
                  >
                    {auction?.discountPool || 0}
                  </Typography>                </Box>
                <Box textAlign="center">
                  <Typography 
                    variant="subtitle2" 
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    {t("lotSelection_used", lang)}
                  </Typography>
                  <Typography 
                    variant="h5" 
                    color="error.main"
                    sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
                  >
                    {auction?.discountUsed || 0}
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Typography 
                    variant="subtitle2" 
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    {t("lotSelection_available", lang)}
                  </Typography>
                  <Typography 
                    variant="h5" 
                    color="success.main"
                    sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
                  >
                    {(auction?.discountPool || 0) - (auction?.discountUsed || 0)}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>          
          <Typography 
            variant="h6" 
            gutterBottom
            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
          >
            {t("lotSelection_lotDiscounts", lang)}
          </Typography>
          <List sx={{ maxHeight: { xs: 200, sm: 300 }, overflow: 'auto' }}>
            {auction.auctionLots.map((auctionLot) => (
              <ListItem key={auctionLot.id} sx={{ py: { xs: 0.5, sm: 1 } }}>
                <ListItemText
                  primary={auctionLot.lot.name}
                  secondary={`${t("lotSelection_discountApplied", lang)} ${auctionLot.lot.discount || 0}`}
                  primaryTypographyProps={{
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                  secondaryTypographyProps={{
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleDiscountViewDialogClose}
            sx={{ minWidth: { xs: 80, sm: 'auto' } }}
          >
            {t("lotSelection_close", lang)}
          </Button>        </DialogActions>
      </Dialog>

      {/* Finish Auction Confirmation Dialog */}
      <Dialog 
        open={finishAuctionDialogOpen} 
        onClose={() => setFinishAuctionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FinishedIcon color="warning" />
          {t('auction_finishConfirmTitle', lang)}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('auction_finishConfirmMessage', lang)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('auction_finishConfirmDetails', lang)}
          </Typography>
          <Box component="ul" sx={{ pl: 2, mb: 0 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              {t('auction_finishAction1', lang)}
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              {t('auction_finishAction2', lang)}
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              {t('auction_finishAction3', lang)}
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              {t('auction_finishAction4', lang)}
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('auction_finishWarning', lang)}
          </Alert>
        </DialogContent>        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setFinishAuctionDialogOpen(false)}
            color="inherit"
          >
            {t('auction_finishConfirmNo', lang)}
          </Button>
          <Button 
            onClick={handleFinishAuctionConfirm}
            variant="contained"
            color="warning"
            startIcon={<FinishedIcon />}
          >
            {t('auction_finishConfirmYes', lang)}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
