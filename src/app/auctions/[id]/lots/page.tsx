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
  TextField,
  Alert,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Paper,
  Avatar,
  Chip,
  Tabs,
  Tab,
  InputAdornment,
  Tooltip,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  DragHandle as DragHandleIcon,
  ArrowBack as ArrowBackIcon,
  MonetizationOn as PriceIcon,
  TrendingUp as StepIcon,
  Timer as TimerIcon,
  Discount as DiscountChipIcon,
} from "@mui/icons-material";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
}

interface AuctionLot {
  id: number;
  order: number;
  lot: Lot;
}

interface Auction {
  id: number;
  name: string;
  auctionLots: AuctionLot[];
}

// Sortable list item component
function SortableItem({ 
  auctionLot, 
  onRemove, 
  lang,
  isRemoving 
}: { 
  auctionLot: AuctionLot; 
  onRemove: (id: number) => void;
  lang: Lang;
  isRemoving: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: auctionLot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{
        backgroundColor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        mb: 1,
        "&:hover": {
          backgroundColor: "action.hover",
        },
      }}
    >
      <IconButton
        {...attributes}
        {...listeners}
        sx={{ mr: 1, cursor: "grab" }}
        size="small"
      >
        <DragHandleIcon />
      </IconButton>
        {auctionLot.lot.photo && (
        <Avatar
          src={auctionLot.lot.photo}
          alt={auctionLot.lot.name}
          sx={{ mr: 2, width: 40, height: 40 }}
        />
      )}
      
      <Box sx={{ flexGrow: 1 }}>
        <ListItemText
          primary={auctionLot.lot.name}
          secondary={auctionLot.lot.description}
        />        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
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
          </Tooltip>
            {auctionLot.lot.discount > 0 && (
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
          
          {(auctionLot.lot.discount > 0 && auctionLot.lot.calculatedPrice !== auctionLot.lot.startingPrice) && (
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
          )}
        </Box>
      </Box>
        <ListItemSecondaryAction>
        <Tooltip title={t("auctionLots_removeFromAuction", lang)}>
          <IconButton
            edge="end"
            onClick={() => onRemove(auctionLot.id)}
            color="error"
            size="small"
            disabled={isRemoving}
          >
            {isRemoving ? (
              <CircularProgress size={20} />
            ) : (
              <RemoveIcon />
            )}
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

export default function AuctionLotsPage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const auctionId = parseInt(params.id as string);

  // Validate auction ID
  if (isNaN(auctionId)) {
    router.push("/auctions");
    return null;
  }
  const [auction, setAuction] = useState<Auction | null>(null);
  const [availableLots, setAvailableLots] = useState<Lot[]>([]);
  const [searchTerm, setSearchTerm] = useState("");  const [selectedLots, setSelectedLots] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingLots, setIsAddingLots] = useState(false);
  const [removingLotId, setRemovingLotId] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    
    if (user) {
      loadData();
    }
  }, [user, loading, router, auctionId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchAuctionLots(), fetchAvailableLots()]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuctionLots = async () => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/lots`);
      if (response.ok) {
        const data = await response.json();
        setAuction(data);
      } else if (response.status === 404) {
        setAlertMessage({
          type: "error",
          message: "Auction not found",
        });
        router.push("/auctions");
      } else {
        throw new Error("Failed to fetch auction lots");
      }
    } catch (error) {
      console.error("Failed to fetch auction lots:", error);
      setAlertMessage({
        type: "error",
        message: "Failed to load auction lots",
      });
    }
  };

  const fetchAvailableLots = async () => {
    try {
      const response = await fetch("/api/lots");
      if (response.ok) {
        const data = await response.json();
        setAvailableLots(data);
      }
    } catch (error) {
      console.error("Failed to fetch lots:", error);
    }
  };
  const handleAddLots = async () => {
    if (selectedLots.size === 0) return;

    setIsAddingLots(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/lots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lotIds: Array.from(selectedLots),
        }),
      });

      if (response.ok) {
        setAlertMessage({
          type: "success",
          message: t("auctionLots_lotAdded", lang),
        });
        setSelectedLots(new Set());
        fetchAuctionLots();
        setTabValue(1); // Switch to auction lots tab
      } else {
        throw new Error("Failed to add lots");
      }
    } catch (error) {
      setAlertMessage({
        type: "error",
        message: "Failed to add lots to auction",
      });
    } finally {
      setIsAddingLots(false);
    }
  };
  const handleRemoveLot = async (auctionLotId: number) => {
    setRemovingLotId(auctionLotId);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/lots`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auctionLotId,
        }),
      });      if (response.ok) {
        setAlertMessage({
          type: "success",
          message: t("auctionLots_lotRemoved", lang),
        });
        // Refresh both auction lots and available lots to ensure UI consistency
        await Promise.all([fetchAuctionLots(), fetchAvailableLots()]);
      } else {
        throw new Error("Failed to remove lot");
      }
    } catch (error) {
      setAlertMessage({
        type: "error",
        message: "Failed to remove lot from auction",
      });
    } finally {
      setRemovingLotId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !auction) return;
    
    if (active.id !== over.id) {
      const auctionLots = auction.auctionLots;
      const oldIndex = auctionLots.findIndex((item) => item.id === active.id);
      const newIndex = auctionLots.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(auctionLots, oldIndex, newIndex);
      
      // Update local state immediately for responsive UI
      setAuction({
        ...auction,
        auctionLots: newItems,
      });

      // Update order on server
      try {
        const updates = newItems.map((item, index) => ({
          id: item.id,
          order: index + 1,
        }));

        const response = await fetch(`/api/auctions/${auctionId}/lots`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ updates }),
        });

        if (response.ok) {
          setAlertMessage({
            type: "success",
            message: t("auctionLots_orderUpdated", lang),
          });
        } else {
          throw new Error("Failed to update order");
        }
      } catch (error) {
        setAlertMessage({
          type: "error",
          message: "Failed to update lot order",
        });
        // Revert local state on error
        fetchAuctionLots();
      }
    }
  };

  const filteredLots = availableLots.filter((lot) => {
    const matchesSearch = lot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Don't show lots that are already in the auction
    const notInAuction = !auction?.auctionLots.some(al => al.lot.id === lot.id);
    
    return matchesSearch && notInAuction;
  });

  const handleLotSelection = (lotId: number, selected: boolean) => {
    const newSelectedLots = new Set(selectedLots);
    if (selected) {
      newSelectedLots.add(lotId);
    } else {
      newSelectedLots.delete(lotId);
    }
    setSelectedLots(newSelectedLots);
  };

  if (loading || !user || isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

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
      )}      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => router.back()} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {t("auctionLots_manageLots", lang)}
          </Typography>
          {auction && (
            <Typography variant="h6" color="text.secondary" sx={{ ml: 2 }}>
              - {auction.name}
            </Typography>
          )}
        </Box>        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/auctions')}
        >
          {t("manageLots_backToAuctions", lang)}
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label={t("auctionLots_addLots", lang)} />
          <Tab label={t("auctionLots_auctionLots", lang)} />
        </Tabs>
      </Paper>

      {/* Add Lots Tab */}
      {tabValue === 0 && (
        <Box>
          {/* Search and Selection Controls */}
          <Paper sx={{ p: 2, mb: 3 }}>            <TextField
              fullWidth
              placeholder={t("auctionLots_searchLots", lang)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              helperText="Search by lot name or description"
              sx={{ mb: 2 }}
            />
            
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">
                {t("auctionLots_availableLots", lang)} ({filteredLots.length})
              </Typography>
                {selectedLots.size > 0 && (
                <Button
                  variant="contained"
                  startIcon={isAddingLots ? <CircularProgress size={20} /> : <AddIcon />}
                  onClick={handleAddLots}
                  disabled={isAddingLots}
                >
                  {t("auctionLots_addToAuction", lang)} ({selectedLots.size})
                </Button>
              )}
            </Box>
          </Paper>          {/* Available Lots List */}
          <Paper>
            {filteredLots.length > 0 && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filteredLots.length > 0 && filteredLots.every(lot => selectedLots.has(lot.id))}
                      indeterminate={filteredLots.some(lot => selectedLots.has(lot.id)) && !filteredLots.every(lot => selectedLots.has(lot.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLots(new Set([...selectedLots, ...filteredLots.map(lot => lot.id)]));
                        } else {
                          const newSelected = new Set(selectedLots);
                          filteredLots.forEach(lot => newSelected.delete(lot.id));
                          setSelectedLots(newSelected);
                        }
                      }}
                    />
                  }
                  label="Select All"
                />
              </Box>
            )}
            {filteredLots.length > 0 ? (
              <List>
                {filteredLots.map((lot, index) => (
                  <Box key={lot.id}>                    <ListItem>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedLots.has(lot.id)}
                            onChange={(e) => handleLotSelection(lot.id, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 1 }}
                      />
                      
                      {lot.photo && (
                        <Avatar
                          src={lot.photo}
                          alt={lot.name}
                          sx={{ mr: 2, width: 40, height: 40 }}
                        />
                      )}
                      
                      <Box sx={{ flexGrow: 1 }}>
                        <ListItemText
                          primary={lot.name}
                          secondary={lot.description}
                        />                        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                          <Tooltip title={t("lot_startingPrice", lang)}>
                            <Chip
                              icon={<PriceIcon sx={{ fontSize: '1rem !important' }} />}
                              label={lot.startingPrice}
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                            />
                          </Tooltip>
                          
                          <Tooltip title={t("lot_priceStep", lang)}>
                            <Chip
                              icon={<StepIcon sx={{ fontSize: '1rem !important' }} />}
                              label={lot.priceStep}
                              size="small"
                              variant="outlined"
                              color="secondary"
                              sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                            />
                          </Tooltip>
                          
                          <Tooltip title={t("lot_timer", lang)}>
                            <Chip
                              icon={<TimerIcon sx={{ fontSize: '1rem !important' }} />}
                              label={`${lot.timer}s`}
                              size="small"
                              variant="outlined"
                              color="info"
                              sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                            />
                          </Tooltip>
                            {lot.discount > 0 && (
                            <Tooltip title={t("lot_discount", lang)}>
                              <Chip
                                icon={<DiscountChipIcon sx={{ fontSize: '1rem !important' }} />}
                                label={lot.discount}
                                size="small"
                                color="error"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                              />
                            </Tooltip>
                          )}
                          
                          {(lot.discount > 0 && lot.calculatedPrice !== lot.startingPrice) && (
                            <Tooltip title={t("lot_calculatedPrice", lang)}>
                              <Chip
                                icon={<PriceIcon sx={{ fontSize: '1rem !important' }} />}
                                label={lot.calculatedPrice}
                                size="small"
                                variant="filled"
                                color="success"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </ListItem>
                    {index < filteredLots.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography color="text.secondary">
                  {searchTerm ? "No lots match your search" : "No available lots"}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Auction Lots Tab */}
      {tabValue === 1 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t("auctionLots_auctionLots", lang)} ({auction?.auctionLots.length || 0})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("auctionLots_dragToReorder", lang)}
            </Typography>
          </Paper>

          <Paper>
            {auction && auction.auctionLots.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={auction.auctionLots.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List sx={{ p: 1 }}>                    {auction.auctionLots.map((auctionLot) => (
                      <SortableItem
                        key={auctionLot.id}
                        auctionLot={auctionLot}
                        onRemove={handleRemoveLot}
                        lang={lang}
                        isRemoving={removingLotId === auctionLot.id}
                      />
                    ))}
                  </List>
                </SortableContext>
              </DndContext>
            ) : (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography color="text.secondary" gutterBottom>
                  {t("auctionLots_noLots", lang)}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => setTabValue(0)}
                >
                  {t("auctionLots_addLots", lang)}
                </Button>
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
}
