"use client";

import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
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
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fab,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Gavel as GavelIcon,
  Timer as TimerIcon,
  TrendingUp as BidIcon,
  Settings as SettingsIcon,
  MonetizationOn as PriceIcon,
  LocalOffer as DiscountIcon,
  CheckCircle as ConnectedIcon,
  Add as AddIcon,
  FlashOn as FlashIcon,
  DeleteForever as DeleteIcon,
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
  status: string;
  sellingStartedAt?: string;
  finalPrice?: number;
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
  discountPool?: number;
  discountUsed?: number;
  useTimer: boolean;
  auctionLots: AuctionLot[];
}

interface DatabaseBid {
  id: number;
  bidderName: string;
  amount: number;
  source: string;
  status: string;
  isWinning: boolean;
  createdAt: string;
  metadata?: any;
}

export default function LiveSellingPage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const auctionId = params.id as string;
  const lotId = params.lotId as string;

  // State
  const [auction, setAuction] = useState<Auction | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [databaseBids, setDatabaseBids] = useState<DatabaseBid[]>([]);
  const [loadingAuction, setLoadingAuction] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [priceChangeDialogOpen, setPriceChangeDialogOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [manualBidDialogOpen, setManualBidDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [manualBidder, setManualBidder] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');
  // New states for timer control and sold functionality
  const [useTimer, setUseTimer] = useState<boolean>(true);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [winningBid, setWinningBid] = useState<DatabaseBid | null>(null);
  const [recentActivity, setRecentActivity] = useState<boolean>(false);
  // Delete bid confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bidToDelete, setBidToDelete] = useState<DatabaseBid | null>(null);
  // Error dialog state
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const bidsListRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load auction and lot data
  useEffect(() => {
    let isCancelled = false; // Keep cancellation flag

    const loadAuctionData = async () => {
      try {
        setLoadingAuction(true);
        const response = await fetch(`/api/auctions/${auctionId}`);

        // Check if component was unmounted before API call completed
        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load auction');
        }

        const auctionData = await response.json();

        // Check again after JSON parsing
        if (isCancelled) {
          return;
        }

        setAuction(auctionData);

        const auctionLot = auctionData.auctionLots.find(
          (al: AuctionLot) => al.lot.id.toString() === lotId
        );

        if (!auctionLot) {
          throw new Error('Lot not found');
        }

        setLot(auctionLot.lot);
        setTimer(auctionLot.lot.timer);

        // Set timer usage based on lot's individual setting (not auction setting)
        setUseTimer(auctionLot.lot.useTimer || false);        // Restore isActive state based on lot status from database
        if (auctionLot.lot.status === 'BEING_SOLD') {
          console.log('🔄 Restored active selling state from database - lot status: BEING_SOLD');
          setIsActive(true);
          
          // Ensure background monitoring is active when page is refreshed
          try {
            // Add a small delay to avoid race conditions with other initialization
            setTimeout(async () => {
              if (isCancelled) return;
              
              // First check if monitoring is already active before starting it
              const statusResponse = await fetch('/api/background-monitor/status');
              const statusData = await statusResponse.json();
              
              const alreadyMonitoring = statusData.jobs?.some(
                (job: any) => job.auctionId === parseInt(auctionId) && job.lotId === parseInt(lotId)
              );
              
              if (!alreadyMonitoring) {
                console.log('🔄 No active monitor found, ensuring monitoring is started');
                const response = await fetch('/api/background-monitor', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    action: 'start',
                    auctionId: parseInt(auctionId),
                    lotId: parseInt(lotId)
                  }),
                });
  
                if (response.ok) {
                  console.log('✅ Successfully started monitoring on page refresh');
                } else {
                  console.error('❌ Failed to start monitoring');
                }
              } else {
                console.log('✓ Monitoring already active, no need to restart');
              }
            }, 500);
          } catch (error) {
            console.error('Error ensuring monitoring is active:', error);
          }
          
          // Immediately start polling when restoring state
          setTimeout(() => {
            if (!isCancelled) {
              fetchDatabaseBids();
            }
          }, 100);
        } else {
          // For lots not being sold, fetch bids once to show current state
          if (!isCancelled) {
            fetchDatabaseBids();
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error loading auction:', error);
          setError(error instanceof Error ? error.message : 'Failed to load auction');
        }
      } finally {
        if (!isCancelled) {
          setLoadingAuction(false);
        }
      }
    };

    if (auctionId && lotId) {
      loadAuctionData();
    }

    // Cleanup function to cancel ongoing operations
    return () => {
      isCancelled = true;
    };
  }, [auctionId, lotId]);
  // Fetch database bids for the current lot
  const fetchDatabaseBids = async () => {
    if (!auctionId || !lotId) return;

    try {
      const response = await fetch(`/api/bids?auctionId=${auctionId}&lotId=${lotId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch bids');
      }

      const data = await response.json();
      const newBids = data.bids || [];

      // Only update state if the data has actually changed
      const hasChanges =
        newBids.length !== databaseBids.length ||
        (newBids.length > 0 && databaseBids.length > 0 &&
          (newBids[0].id !== databaseBids[0].id || newBids[0].amount !== databaseBids[0].amount));

      if (hasChanges) {
        // Check if there are new bids for activity indicator
        if (databaseBids.length > 0 && newBids.length > databaseBids.length) {
          setRecentActivity(true);
          // Clear the activity indicator after 3 seconds
          setTimeout(() => setRecentActivity(false), 3000);
        }

        setDatabaseBids(newBids);
      }

    } catch (error) {
      console.error('Error fetching database bids:', error);
    }
  };
  // Create manual bid
  const createManualBid = async (bidderName: string, amount: number) => {
    if (!auctionId || !lotId) return;

    try {
      const response = await fetch('/api/bids/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId: parseInt(auctionId),
          lotId: parseInt(lotId),
          bidderName,
          amount
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Manual bid created successfully');
        await fetchDatabaseBids(); // Refresh bids
        return { success: true, bid: result.bid };
      } else {
        console.error('❌ Failed to create manual bid:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error creating manual bid:', error);
      return { success: false, error: 'Failed to create bid' };
    }
  };
  // Remove top bid
  const removeTopBid = async () => {
    if (databaseBids.length === 0) {
      return;
    }

    const topBid = databaseBids[0];
    setBidToDelete(topBid);
    setDeleteDialogOpen(true);
  };
  // Confirm delete bid
  const confirmDeleteBid = async () => {
    if (!bidToDelete) return;

    try {
      const response = await fetch(`/api/bids/${bidToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('✅ Top bid removed successfully');
        await fetchDatabaseBids(); // Refresh bids
      } else {
        const result = await response.json();
        console.error('❌ Failed to remove bid:', result.error);
      }
    } catch (error) {
      console.error('Error removing bid:', error);
    } finally {
      handleDeleteDialogClose();
    }
  };
  // Update lot status
  const updateLotStatus = async (status: 'READY' | 'BEING_SOLD' | 'SOLD' | 'WITHDRAWN') => {
    try {
      const response = await fetch(`/api/lots/${lotId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        console.log(`📋 Lot status updated to: ${status}`);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Failed to update lot status:', errorData.error);        // Show error message to user if available
        if (errorData.error) {
          setErrorMessage(errorData.error);
          setErrorDialogOpen(true);
        } else {
          setErrorMessage('Failed to update lot status');
          setErrorDialogOpen(true);
        }

        return false;
      }
    } catch (error) {
      console.error('Error updating lot status:', error);
      setErrorMessage('Failed to update lot status');
      setErrorDialogOpen(true);
      return false;
    }
  };
  // Always show the top bids (highest bids) at the top of the list
  useEffect(() => {
    if (bidsListRef.current) {
      bidsListRef.current.scrollTop = 0; // Scroll to top instead of bottom
    }
  }, [databaseBids]);
  // Timer countdown (only if timer is enabled)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && useTimer && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0 && isActive && useTimer) {
      // Timer ran out - auto-sell the lot
      handleSoldLot();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timer, useTimer]);
  // Start/stop database bid polling (YouTube polling happens in background)
  useEffect(() => {
    if (isActive) {
      // Poll database every 5 seconds for real-time bid updates
      fetchDatabaseBids(); // Initial load
      pollingRef.current = setInterval(fetchDatabaseBids, 5000); // 5 seconds - fast database polling
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isActive]);  // Handlers
  const handleStartSelling = async () => {
    // Optimistically set state
    setIsActive(true);
    setTimer(lot?.timer || 300);

    // Update lot status to trigger background monitoring
    const success = await updateLotStatus('BEING_SOLD');

    if (success) {
      await fetchDatabaseBids(); // Refresh database bids
      console.log('🚀 Started selling - background monitoring should now be active');
    } else {
      // Revert state if update failed
      setIsActive(false);
    }
  };

  const handleStopSelling = async () => {
    setIsActive(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    await updateLotStatus('READY');
  };  // Dialog close handlers with focus management for accessibility
  const handleManualBidDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setManualBidDialogOpen(false);
    setManualBidder('');
    setManualAmount('');
  };

  const handlePriceChangeDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setPriceChangeDialogOpen(false);
    setNewPrice('');
  };

  const handleDiscountDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDiscountDialogOpen(false);
    setDiscountAmount('');
  };
  const handleDeleteDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDeleteDialogOpen(false);
    setBidToDelete(null);
  };

  const handleErrorDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setErrorDialogOpen(false);
    setErrorMessage('');
  };

  const handleManualBid = async () => {
    const bidderName = manualBidder.trim();
    const amount = parseFloat(manualAmount); if (!bidderName || !amount || amount <= 0) {
      setErrorMessage(t('liveSelling_validationBidderAmount', lang));
      setErrorDialogOpen(true);
      return;
    }

    const result = await createManualBid(bidderName, amount);

    if (result?.success) {
      handleManualBidDialogClose();
    } else {
      setErrorMessage(result?.error || t('liveSelling_failedToCreateBid', lang));
      setErrorDialogOpen(true);
    }
  }; const handlePriceChange = async () => {
    const newStartingPrice = parseFloat(newPrice);

    if (isNaN(newStartingPrice) || newStartingPrice <= 0) {
      setErrorMessage('Please enter a valid starting price');
      setErrorDialogOpen(true);
      return;
    }

    if (!lot) return;

    try {
      const response = await fetch(`/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingPrice: newStartingPrice
        }),
      }); if (response.ok) {
        // Get the updated lot data
        const updatedLot = await response.json();
        // Update lot state
        setLot(updatedLot);

        // Close dialog and clear form
        handlePriceChangeDialogClose();
      } else {
        setErrorMessage('Failed to update starting price');
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('Error updating starting price:', error);
      setErrorMessage('Failed to update starting price');
      setErrorDialogOpen(true);
    }
  }; const handleDiscountApply = async () => {
    const discount = parseFloat(discountAmount);

    if (isNaN(discount) || discount < 0) {
      setErrorMessage('Please enter a valid discount amount');
      setErrorDialogOpen(true);
      return;
    }

    if (!lot) return;

    try {
      // We're setting the discount directly to the new value, not incrementing it
      const response = await fetch(`/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount: discount
        }),
      }); if (response.ok) {        // Refresh lot data
        const updatedLot = await response.json();
        setLot(updatedLot);

        handleDiscountDialogClose();
      } else {
        setErrorMessage('Failed to apply discount');
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('Error applying discount:', error);
      setErrorMessage('Failed to apply discount');
      setErrorDialogOpen(true);
    }
  }; const handleSoldLot = async () => {
    if (databaseBids.length === 0) {
      setErrorMessage(t('liveSelling_noBidsToFinalize', lang));
      setErrorDialogOpen(true);
      return;
    }

    const highestBid = databaseBids[0]; // Already sorted by amount desc
    setWinningBid(highestBid);

    // Stop any active processes
    setIsActive(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      // Update lot status and final price using PATCH endpoint
      const response = await fetch(`/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'SOLD',
          finalPrice: highestBid.amount
        }),
      });

      if (response.ok) {
        const updatedLot = await response.json();
        setLot(updatedLot); // Update local lot state
        console.log('✅ Lot marked as SOLD with final price:', highestBid.amount);
      } else {
        const errorData = await response.json();
        console.error('Failed to update lot to SOLD:', errorData.error);
        setErrorMessage(errorData.error || 'Failed to mark lot as sold');
        setErrorDialogOpen(true);
        return;
      }
    } catch (error) {
      console.error('Error marking lot as sold:', error);
      setErrorMessage('Failed to mark lot as sold');
      setErrorDialogOpen(true);
      return;
    }

    // Show congratulations dialog
    setSoldDialogOpen(true);
    // Auto close after 5 seconds and redirect
    setTimeout(() => {
      setSoldDialogOpen(false);
      router.push(`/auctions/${auctionId}`);
    }, 5000);
  };
  const toggleTimer = async () => {
    const newTimerState = !useTimer;
    setUseTimer(newTimerState);

    // Update lot's timer setting
    try {
      const response = await fetch(`/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ useTimer: newTimerState }),
      });

      if (!response.ok) {
        console.error('Failed to update lot timer setting');
        setUseTimer(!newTimerState); // Revert on error
      }
    } catch (error) {
      console.error('Error updating lot timer setting:', error);
      setUseTimer(!newTimerState); // Revert on error
    }
  };
  // Test bid function to simulate background processing
  const handleTestBid = async () => {
    if (!auctionId || !lotId || !lot) return;

    try {
      console.log('🧪 Testing background bid processing...');

      // Calculate a test bid amount (current price + price step)
      const currentHighestBid = databaseBids[0];
      const currentPrice = currentHighestBid ? Number(currentHighestBid.amount) : Number(lot.calculatedPrice);
      const testBidAmount = currentPrice + Number(lot.priceStep);

      const response = await fetch('/api/test/simulate-bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId: parseInt(auctionId),
          lotId: parseInt(lotId),
          bidderName: `TestUser${Date.now().toString().slice(-4)}`,
          amount: testBidAmount
        }),
      });

      const result = await response.json();
      if (response.ok) {
        console.log('✅ Test bid processed successfully:', result);
        // Refresh bids to show the new test bid
        await fetchDatabaseBids();
        setErrorMessage(`✅ Test bid successful!\nProcessed: ${result.result.processed}\nCreated: ${result.result.created}`);
        setErrorDialogOpen(true);
      } else {
        console.error('❌ Test bid failed:', result.error);
        setErrorMessage(`❌ Test bid failed: ${result.error}`);
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('Error testing background bid:', error);
      setErrorMessage('❌ Error testing background bid');
      setErrorDialogOpen(true);
    }
  };  // Test timestamp filtering function
  const handleTestTimestampFiltering = async () => {
    if (!auctionId || !lotId || !lot) return;

    try {
      console.log('🧪 Testing timestamp filtering...');

      // Create test bids: some old (before selling started), some new (after selling started)
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const testBids = [
        {
          authorName: 'OldBidder1',
          authorPhotoUrl: '',
          timestamp: oneHourAgo.toISOString(), // This should be filtered out
          amount: Number(lot.calculatedPrice) + 50,
          messageId: `test-old-${Date.now()}-1`
        },
        {
          authorName: 'OldBidder2',
          authorPhotoUrl: '',
          timestamp: oneHourAgo.toISOString(), // This should be filtered out
          amount: Number(lot.calculatedPrice) + 100,
          messageId: `test-old-${Date.now()}-2`
        },
        {
          authorName: 'RecentBidder1',
          authorPhotoUrl: '',
          timestamp: fiveMinutesAgo.toISOString(), // This should be processed (if after selling started)
          amount: Number(lot.calculatedPrice) + 25,
          messageId: `test-recent-${Date.now()}-1`
        },
        {
          authorName: 'RecentBidder2',
          authorPhotoUrl: '',
          timestamp: now.toISOString(), // This should be processed
          amount: Number(lot.calculatedPrice) + 75,
          messageId: `test-recent-${Date.now()}-2`
        }
      ];

      const response = await fetch('/api/test/timestamp-filtering', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId: parseInt(auctionId),
          lotId: parseInt(lotId),
          testBids
        }),
      });

      const result = await response.json();
      if (response.ok) {
        console.log('✅ Timestamp filtering test results:', result);
        await fetchDatabaseBids(); // Refresh bids
        setErrorMessage(`✅ Timestamp filtering test completed!\n\nSent: ${testBids.length} test bids\nProcessed: ${result.result.processed}\nCreated: ${result.result.created}\n\nOld bids should be filtered out!`);
        setErrorDialogOpen(true);
      } else {
        console.error('❌ Timestamp filtering test failed:', result.error);
        setErrorMessage(`❌ Test failed: ${result.error}`);
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('Error testing timestamp filtering:', error);
      setErrorMessage('❌ Error testing timestamp filtering');
      setErrorDialogOpen(true);
    }
  };

  const formatCurrency = (amount: number | string | any): string => {
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount.toString());
    return isNaN(numAmount) ? '0' : numAmount.toFixed(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || loadingAuction) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          {t('manageLots_back', lang)}
        </Button>
      </Box>
    );
  }
  if (!auction || !lot) {
    return (
      <Box p={3}>
        <Alert severity="error">{t('liveSelling_auctionOrLotNotFound', lang)}</Alert>
      </Box>
    );
  } return (
    <Box sx={{
      p: { xs: 1, sm: 2 },
      width: '100%',
      maxWidth: { xs: 'unset', md: 1200 },
      mx: { xs: 0, md: 'auto' }
    }}>      {/* Header - now empty, back button moved to card */}
      <Box mb={2} />{/* Two-column layout */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 2, md: 3 },
          alignItems: 'flex-start',
          width: '100%'
        }}
      >        {/* Left Column - Lot Details */}
        <Box
          sx={{
            flex: 1,
            width: '100%'
          }}
        >
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>              {/* Lot Header */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                {/* Back Button */}
                <Tooltip title={t('manageLots_back', lang)}>
                  <IconButton
                    onClick={() => router.back()}
                    size="small"
                    sx={{
                      border: 1,
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.light',
                        borderColor: 'primary.dark'
                      }
                    }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </Tooltip>                {/* Centered Title */}
                <Typography
                  variant="h6"
                  component="h1"
                  sx={{
                    textAlign: 'center',
                    flex: 1,
                    mx: 2,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                    maxHeight: '2.4em'
                  }}
                >
                  {lot.name}
                </Typography>

                {/* Settings Button */}
                <Tooltip title="Settings">
                  <IconButton
                    onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                    size="small"
                    sx={{
                      border: 1,
                      borderColor: 'secondary.main',
                      color: 'secondary.main',
                      '&:hover': {
                        bgcolor: 'secondary.light',
                        borderColor: 'secondary.dark'
                      }
                    }}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </Box>              {/* Lot Image */}
              {lot.photo && (
                <Box
                  component="img"
                  src={lot.photo}
                  alt={lot.name}
                  sx={{
                    width: '100%',
                    aspectRatio: '3/2',
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: 1,
                    mb: 2
                  }}
                />
              )}

              {/* Lot Details */}
              <Box sx={{ mb: 2 }}>
                {/* Description */}
                {lot.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                    {lot.description}
                  </Typography>
                )}                {/* Lot Parameters - More mobile friendly version */}
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: 1
                }}>
                  {/* Starting Price */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Typography variant="body1" fontWeight="500" color="text.primary">
                      {t('liveSelling_startingPrice', lang)}:
                    </Typography>
                    <Typography variant="h5" fontWeight="800" color="primary.main">
                      {formatCurrency(lot.calculatedPrice)}
                    </Typography>
                  </Box>
                  
                  {/* Price Step */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Typography variant="body1" fontWeight="500" color="text.primary">
                      {t('liveSelling_priceStep', lang)}:
                    </Typography>
                    <Typography variant="h6" fontWeight="700" color="secondary.main">
                      {formatCurrency(lot.priceStep)}
                    </Typography>
                  </Box>
                  
                  {/* Discount - only show if there's a discount */}
                  {(lot.discount && Number(lot.discount) > 0) && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <Typography variant="body1" fontWeight="500" color="text.primary">
                        {t('lot_discount', lang)}:
                      </Typography>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1.5,
                          py: 0.5,
                          bgcolor: 'error.light',
                          color: 'error.contrastText',
                          borderRadius: 2,
                          fontWeight: 700,
                          fontSize: '1rem'
                        }}
                      >
                        <DiscountIcon sx={{ fontSize: '1.2em' }} />
                        -{formatCurrency(lot.discount)}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Timer - only show if timer is enabled */}
              {useTimer && (
                <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                  <TimerIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    {formatTime(timer)}
                  </Typography>
                </Box>
              )}              {/* Controls */}
              <Box display="flex" gap={1} justifyContent="center" mb={0} flexWrap="wrap">
                <Button
                  variant={isActive ? "outlined" : "contained"}
                  color={isActive ? "secondary" : "primary"}
                  size={isActive ? "small" : "large"}
                  startIcon={isActive ? <GavelIcon /> : <GavelIcon />}
                  onClick={isActive ? handleStopSelling : handleStartSelling}
                  disabled={auction.status !== 'READY' && auction.status !== 'STARTED'}
                  sx={{
                    minWidth: isActive ? '30%' : 140,
                    flex: isActive ? '0 0 30%' : 'auto'
                  }}
                >
                  {isActive ? t('liveSelling_stopSelling', lang) : t('liveSelling_startSelling', lang)}
                </Button>

                {/* SOLD Button - takes remaining 70% space */}
                {isActive && databaseBids.length > 0 && (<Button
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={handleSoldLot}
                  sx={{
                    flex: '1 1 70%',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    minHeight: 48
                  }}
                >
                  🔨 SOLD!
                </Button>
                )}
              </Box>

            </CardContent>
          </Card>
        </Box>        {/* Right Column - Bids List */}
        <Box
          sx={{
            flex: 1,
            width: '100%'
          }}
        >
          <Card sx={{ width: '100%' }}>            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>                  <Typography variant="h6">
              {t('liveSelling_liveBids', lang)} ({databaseBids.length})
            </Typography>
              {recentActivity && (
                <FlashIcon
                  sx={{
                    color: 'warning.main',
                    fontSize: '1.2rem',
                    animation: 'pulse 1.5s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                      '100%': { opacity: 1 }
                    }
                  }}
                />
              )}
            </Box>
            {/* Background Processing Status */}
            <Tooltip title={t('liveSelling_backgroundProcessingActive', lang)}>
              <IconButton size="small">
                <ConnectedIcon color="success" />
              </IconButton>
            </Tooltip>
          </Box>
            <Paper
              ref={bidsListRef}
              sx={{
                maxHeight: 400,
                overflow: 'auto',
                border: 1,
                borderColor: 'divider'
              }}
            >
              {loadingBids ? (
                <Box p={2} textAlign="center">
                  <CircularProgress size={24} />
                </Box>) : databaseBids.length === 0 ? (
                  <Box p={2} textAlign="center">
                    <Typography color="text.secondary">
                      {t('liveSelling_noBidsYet', lang)}
                    </Typography>
                  </Box>
                ) : (
                <List dense>
                  {databaseBids.map((bid, index) => (
                    <ListItem key={bid.id}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: bid.isWinning ? 'success.main' : 'grey.400' }}>
                          {bid.bidderName.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>                        <ListItemText
                        primary={`${formatCurrency(bid.amount)} - ${bid.bidderName}`}
                        secondary={`${bid.source} • ${new Date(bid.createdAt).toLocaleTimeString()}${bid.isWinning ? ' • WINNING' : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}              </Paper>
          </CardContent>
          </Card>        </Box>
      </Box>      {/* Burger Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >        <MenuItem onClick={() => {
        setMenuAnchorEl(null);
        setNewPrice((lot?.startingPrice || 0).toString());
        setPriceChangeDialogOpen(true);
      }}>
          <PriceIcon sx={{ mr: 1 }} />
          {t('liveSelling_changePrice', lang)}
        </MenuItem>      <MenuItem onClick={() => {
          setMenuAnchorEl(null);
          setDiscountAmount((lot?.discount || 0).toString());
          setDiscountDialogOpen(true);
        }}>
          <DiscountIcon sx={{ mr: 1 }} />
          {t('liveSelling_applyDiscount', lang)}
        </MenuItem><MenuItem onClick={() => { setMenuAnchorEl(null); setManualBidDialogOpen(true); }}>
          <AddIcon sx={{ mr: 1 }} />
          {t('liveSelling_manualBid', lang)}
        </MenuItem>        <MenuItem
          onClick={() => { setMenuAnchorEl(null); removeTopBid(); }}
          disabled={databaseBids.length === 0}
          sx={{ color: databaseBids.length === 0 ? 'text.disabled' : 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          {t('liveSelling_removeTopBid', lang)}
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchorEl(null); toggleTimer(); }}>
          <TimerIcon sx={{ mr: 1 }} />
          {useTimer ? t('liveSelling_disableTimer', lang) : t('liveSelling_enableTimer', lang)}
        </MenuItem>
      </Menu>      {/* Manual Bid Dialog */}
      <Dialog open={manualBidDialogOpen} onClose={handleManualBidDialogClose}>
        <DialogTitle>{t('liveSelling_createManualBid', lang)}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('liveSelling_bidderName', lang)}
            value={manualBidder}
            onChange={(e) => setManualBidder(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('liveSelling_bidAmount', lang)}
            type="number"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            margin="normal"
          />
        </DialogContent>        <DialogActions>
          <Button onClick={handleManualBidDialogClose}>{t('liveSelling_cancel', lang)}</Button>
          <Button onClick={handleManualBid} variant="contained">{t('liveSelling_createBid', lang)}</Button>
        </DialogActions>
      </Dialog>      {/* Change Price Dialog */}
      <Dialog open={priceChangeDialogOpen} onClose={handlePriceChangeDialogClose}>
        <DialogTitle>{t('liveSelling_changePrice', lang)}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {t("lot_startingPrice", lang)}:
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="primary.main">
              {formatCurrency(lot?.startingPrice || 0)}
            </Typography>
          </Box>
          <TextField
            fullWidth
            label={t("lot_startingPrice", lang)}
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            margin="normal"
            helperText="Enter the new starting price"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePriceChangeDialogClose}>{t('liveSelling_cancel', lang)}</Button>
          <Button onClick={handlePriceChange} variant="contained">{t('liveSelling_save', lang)}</Button>
        </DialogActions>
      </Dialog>{/* Apply Discount Dialog */}
      <Dialog open={discountDialogOpen} onClose={handleDiscountDialogClose}>
        <DialogTitle>{t('liveSelling_applyDiscount', lang)}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {t("lot_discount", lang)}:
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main">
              {formatCurrency(lot?.discount || 0)}
            </Typography>
          </Box>
          <TextField
            fullWidth
            label={t('liveSelling_discountAmount', lang)}
            type="number"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            margin="normal"
            helperText="Enter the discount value to set"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDiscountDialogClose}>{t('liveSelling_cancel', lang)}</Button>
          <Button onClick={handleDiscountApply} variant="contained">{t('liveSelling_save', lang)}</Button>
        </DialogActions>
      </Dialog>{/* Delete Bid Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        maxWidth="sm"
        fullWidth
      ><DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        color: 'error.main'
      }}>
          <DeleteIcon />
          {t('liveSelling_removeTopBid', lang)}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('liveSelling_confirmRemoveBid', lang)}
            </Typography>
            {bidToDelete && (
              <Box sx={{
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                mb: 2
              }}>                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>{t('bid_bidder', lang)}:</strong> {bidToDelete.bidderName}
                </Typography>
                <Typography variant="h5" color="primary.main" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(bidToDelete.amount)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {bidToDelete.source} • {new Date(bidToDelete.createdAt).toLocaleString()}
                </Typography>
              </Box>
            )}            <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>
              ⚠️ {t('liveSelling_actionCannotBeUndone', lang)}
            </Typography>
          </Box>
        </DialogContent>        <DialogActions sx={{ px: 3, pb: 3 }}>          <Button
          onClick={handleDeleteDialogClose}
          variant="outlined"
          sx={{ flex: 1 }}
        >
          {t('liveSelling_cancel', lang)}
        </Button>
          <Button
            onClick={confirmDeleteBid}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            sx={{ flex: 1 }}
          >
            {t('liveSelling_removeBid', lang)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Congratulations Dialog */}
      <Dialog
        open={soldDialogOpen}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
            color: 'white',
            textAlign: 'center',
            p: 3
          }
        }}
      >        <DialogContent sx={{ pt: 4, pb: 4 }}>
          <Typography variant="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
            🎉 {t('liveSelling_congratulations', lang)} 🎉
          </Typography>
          <Typography variant="h4" sx={{ mb: 3 }}>
            {t('liveSelling_sold', lang)}
          </Typography>

          {winningBid && (
            <>
              <Typography variant="h5" sx={{ mb: 2 }}>
                <strong>{lot?.name}</strong>
              </Typography>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {t('liveSelling_goesTo', lang)} <strong>{winningBid.bidderName}</strong>
              </Typography>              <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                {t('liveSelling_for', lang)} {formatCurrency(winningBid.amount)}!
              </Typography>
            </>
          )}

          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            {t('liveSelling_returningMessage', lang)}
          </Typography>          <LinearProgress
            sx={{
              mt: 2,
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.3)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'white'
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog
        open={errorDialogOpen}
        onClose={handleErrorDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: 'error.main'
        }}>
          ⚠️ Error
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 1 }}>
            {errorMessage}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleErrorDialogClose}
            variant="contained"
            color="primary"
            fullWidth
          >
            {t('liveSelling_cancel', lang)}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
