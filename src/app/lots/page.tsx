"use client";

import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t, Lang } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {  Box,
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
  IconButton,
  Tooltip,
  CardMedia,
  Chip,
  Skeleton,
  CircularProgress,
  InputAdornment,
  FormControl,
  Select,
  InputLabel,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PhotoCamera as PhotoIcon,
  Crop as CropIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  // Add these new icons
  MonetizationOn as PriceIcon,
  TrendingUp as StepIcon,
  Timer as TimerIcon,
  Discount as DiscountChipIcon,
  Description as DescriptionIcon,
  Image as ImageIcon,
} from "@mui/icons-material";
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface Lot {
  id: string;
  name: string;
  description: string | null;
  photo: string | null;
  startingPrice: number;
  priceStep: number;
  timer: number;
  discount: number;
  calculatedPrice: number;
  status: string;
}

export default function LotsPage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();  const [lots, setLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("READY");
  const [lotsLoading, setLotsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [deletingLot, setDeletingLot] = useState<Lot | null>(null);
    const [formData, setFormData] = useState({
    name: "",
    description: "",
    photo: "",
    startingPrice: 100,
    priceStep: 10,
    timer: 120,
    discount: 0,
  });
  
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Image cropping states
  const [tempImage, setTempImage] = useState<string>("");
  const [crop, setCrop] = useState<Crop>({
    unit: 'px',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user) {
      fetchLots();
    }
  }, [user, loading, router]);  // Refresh lots data when page becomes visible (switching tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('Page became visible, refreshing lots data...');
        fetchLots();
      }
    };

    const handleFocus = () => {
      if (user) {
        console.log('Window focused, refreshing lots data...');
        fetchLots();
      }
    };

    // Listen for both visibility change and window focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  // Also refresh when navigating back to this route
  useEffect(() => {
    const handleRouteChange = () => {
      if (user) {
        console.log('Route changed, refreshing lots data...');
        fetchLots();
      }
    };

    // Listen for browser navigation events
    window.addEventListener('pageshow', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('pageshow', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [user]);
  // Filter lots when search query changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredLots(lots);
    } else {
      const filtered = lots.filter(lot =>
        lot.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLots(filtered);
    }
  }, [lots, searchQuery]);

  // Refetch lots when status filter changes
  useEffect(() => {
    if (user) {
      fetchLots();
    }
  }, [statusFilter, user]);const fetchLots = async () => {
    setLotsLoading(true);
    try {
      // Add cache-busting parameter and status filter to ensure fresh data
      const params = new URLSearchParams({
        t: Date.now().toString(),
        status: statusFilter
      });
      const response = await fetch(`/api/lots?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLots(data);
        console.log('Lots data refreshed:', data.length, 'lots');
      }
    } catch (error) {
      console.error("Failed to fetch lots:", error);
    } finally {
      setLotsLoading(false);
    }
  };

  const handleDialogOpen = (lot?: Lot) => {
    if (lot) {
      setEditingLot(lot);
      setFormData({
        name: lot.name,
        description: lot.description || "",
        photo: lot.photo || "",
        startingPrice: Number(lot.startingPrice),
        priceStep: Number(lot.priceStep),        timer: lot.timer,
        discount: Number(lot.discount),
      });
    } else {
      setEditingLot(null);
      setFormData({
        name: "",
        description: "",
        photo: "",
        startingPrice: 100,
        priceStep: 10,
        timer: 120,
        discount: 0,
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
    setEditingLot(null);
  };

  const handleSave = async () => {
    try {
      const url = editingLot ? `/api/lots/${editingLot.id}` : "/api/lots";
      const method = editingLot ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },        body: JSON.stringify({
          ...formData,
        }),
      });

      if (response.ok) {
        setAlertMessage({
          type: "success",
          message: editingLot ? t("lot_updated", lang) : t("lot_created", lang),
        });
        handleDialogClose();
        fetchLots();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("API Error:", response.status, errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
    } catch (error) {
      console.error("Save error:", error);
      setAlertMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save lot",
      });
    }
  };
  const handleDeleteConfirm = async () => {
    if (!deletingLot) return;

    try {
      const response = await fetch(`/api/lots/${deletingLot.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAlertMessage({
          type: "success",
          message: t("lot_deleted", lang),
        });
        fetchLots();
      } else {
        throw new Error("Failed to delete lot");
      }
    } catch (error) {
      setAlertMessage({
        type: "error",
        message: "Failed to delete lot",
      });
    } finally {
      handleDeleteDialogClose();
    }
  };
  const handleDeleteClick = (lot: Lot) => {
    setDeletingLot(lot);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDeleteDialogOpen(false);
    setDeletingLot(null);
  };

  const handleCropDialogClose = () => {
    // Remove focus from any active element to prevent aria-hidden accessibility warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setCropDialogOpen(false);
    setTempImage("");
  };

  // Image handling functions
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempImage(e.target?.result as string);
        setCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      300,
      200
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            console.error('Canvas is empty');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.9
      );
    });
  };
  const handleCropSave = async () => {
    if (imgRef.current && completedCrop) {
      try {
        const croppedImageBase64 = await getCroppedImg(imgRef.current, completedCrop);
        setFormData({ ...formData, photo: croppedImageBase64 });
        handleCropDialogClose();
      } catch (error) {
        console.error('Error cropping image:', error);
      }
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
      )}      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {t("nav_lots", lang)}
        </Typography>
        <Box display="flex" gap={1}>
          <IconButton
            onClick={fetchLots}
            disabled={lotsLoading}
            color="primary"
            sx={{ 
              '&:hover': { backgroundColor: 'action.hover' },
              transition: 'all 0.2s'
            }}
          >
            <RefreshIcon sx={{ 
              animation: lotsLoading ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleDialogOpen()}
          >
            {t("lot_createLot", lang)}
          </Button>
        </Box>
      </Box>      {/* Search and Filter Section */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder={t("lots_searchPlaceholder", lang)}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, maxWidth: { xs: '100%', sm: 400 } }}
        />
        
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="status-filter-label">{t("lots_statusFilter", lang)}</InputLabel>
          <Select
            labelId="status-filter-label"
            value={statusFilter}
            label={t("lots_statusFilter", lang)}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="ALL">{t("lots_allStatuses", lang)}</MenuItem>
            <MenuItem value="READY">{t("lotStatus_ready", lang)}</MenuItem>
            <MenuItem value="BEING_SOLD">{t("lotStatus_being_sold", lang)}</MenuItem>
            <MenuItem value="SOLD">{t("lotStatus_sold", lang)}</MenuItem>
            <MenuItem value="WITHDRAWN">{t("lotStatus_withdrawn", lang)}</MenuItem>
          </Select>
        </FormControl>
      </Box>{/* Lots Grid */}
      {lotsLoading ? (
        // Loading Skeleton
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)' 
          }, 
          gap: { xs: 2, sm: 3 },
          mt: 3 
        }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Skeleton variant="rectangular" height={200} />
              <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 } }}>
                <Skeleton variant="text" sx={{ fontSize: '1.25rem', mb: 1 }} />
                <Skeleton variant="text" sx={{ fontSize: '0.875rem', mb: 2 }} width="80%" />
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Skeleton variant="rounded" width={80} height={24} />
                  <Skeleton variant="rounded" width={60} height={24} />
                  <Skeleton variant="rounded" width={70} height={24} />
                </Box>
              </CardContent>
              <CardActions sx={{ p: { xs: 1.5, sm: 2 }, pt: 0 }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="circular" width={32} height={32} />
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <>
          {/* Actual Lots Grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)', 
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)' 
            }, 
            gap: { xs: 2, sm: 3 },
            mt: 3 
          }}>
            {filteredLots.map((lot) => (
              <Card 
                key={lot.id}
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
                {/* ...existing card content... */}
                {/* Image Section */}
                {lot.photo ? (
                  <CardMedia
                    component="img"
                    height="200"
                    image={lot.photo}
                    alt={lot.name}
                    sx={{ objectFit: 'cover' }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 200,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'grey.400'
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 48 }} />
                  </Box>
                )}
                
                <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 } }}>
                  {/* Title */}
                  <Typography 
                    variant="h6" 
                    component="h2" 
                    gutterBottom
                    sx={{ 
                      fontSize: { xs: '1.1rem', sm: '1.25rem' },
                      fontWeight: 600,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {lot.name}
                  </Typography>
                  
                  {/* Description */}
                  {lot.description && (
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
                        {lot.description}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Chips with Icons */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: { xs: 0.5, sm: 1 }, 
                    mb: 2, 
                    flexWrap: 'wrap'
                  }}>
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
                    </Tooltip>                    {lot.discount > 0 && (
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
                </CardContent>
                
                {/* Actions */}
                <CardActions sx={{ p: { xs: 1.5, sm: 2 }, pt: 0 }}>
                  <Box 
                    display="flex" 
                    width="100%" 
                    justifyContent="flex-start"
                    alignItems="center"
                  >
                    <Box display="flex" gap={0.5}>
                      <Tooltip title={t("lot_edit", lang)}>
                        <IconButton 
                          size="small"
                          onClick={() => handleDialogOpen(lot)}
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title={t("lot_delete", lang)}>
                        <IconButton 
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(lot)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardActions>
              </Card>
            ))}
          </Box>
          
          {/* Empty State - Show when no lots or no search results */}
          {filteredLots.length === 0 && (
            <Box 
              textAlign="center" 
              py={6}
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                mt: 3
              }}
            >
              <ImageIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {searchQuery.trim() === "" 
                  ? t("lots_noLotsTitle", lang)
                  : "No lots found"
                }
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {searchQuery.trim() === "" 
                  ? t("lots_noLotsDescription", lang)
                  : `No lots match "${searchQuery}"`
                }
              </Typography>
              {searchQuery.trim() === "" && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleDialogOpen()}
                  size="large"
                >
                  {t("lot_createLot", lang)}
                </Button>
              )}
            </Box>
          )}
        </>
      )}

      {/* Create/Edit Dialog - Enhanced for Mobile */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleDialogClose} 
        maxWidth="sm" 
        fullWidth
        disableScrollLock={true}
        PaperProps={{
          sx: { 
            m: { xs: 1, sm: 2 },
            width: { xs: 'calc(100vw - 16px)', sm: 'auto' },
            maxHeight: { xs: 'calc(100vh - 32px)', sm: 'auto' }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {editingLot ? t("lot_editLot", lang) : t("lot_createLot", lang)}
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <TextField
            autoFocus
            margin="dense"
            label={t("lot_name", lang)}
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
            InputProps={{
              sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
            }}
          />
          
          <TextField
            margin="dense"
            label={t("lot_description", lang)}
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
            InputProps={{
              sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
            }}
          />

          {/* Photo Upload Section - Enhanced */}
          <Box sx={{ mb: 2 }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              ref={fileInputRef}
            />
            <Button
              variant="outlined"
              startIcon={<PhotoIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ 
                mb: 1,
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              {t("lot_uploadPhoto", lang)}
            </Button>
            
            {formData.photo && (
              <Box 
                sx={{ 
                  mt: 1,
                  display: 'flex',
                  justifyContent: 'center', // Center the image container
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                <img
                  src={formData.photo}
                  alt="Preview"
                  style={{ 
                    width: '100%', 
                    maxWidth: 300, 
                    height: 'auto',
                    display: 'block'
                  }}
                />
              </Box>
            )}
          </Box>
          
          {/* Input Fields in Grid for Better Mobile Layout */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
            gap: 2, 
            mb: 2 
          }}>
            <TextField
              label={t("lot_startingPrice", lang)}
              type="number"
              variant="outlined"
              value={formData.startingPrice}
              onChange={(e) => setFormData({ ...formData, startingPrice: Number(e.target.value) })}
              InputProps={{
                sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
              }}
            />
            
            <TextField
              label={t("lot_priceStep", lang)}
              type="number"
              variant="outlined"
              value={formData.priceStep}
              onChange={(e) => setFormData({ ...formData, priceStep: Number(e.target.value) })}
              InputProps={{
                sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
              }}
            />
          </Box>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
            gap: 2, 
            mb: 2 
          }}>
            <TextField
              label={t("lot_timer", lang)}
              type="number"
              variant="outlined"
              value={formData.timer}
              onChange={(e) => setFormData({ ...formData, timer: Number(e.target.value) })}
              InputProps={{
                sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
              }}
            />
            
            <TextField
              label={t("lot_discount", lang)}
              type="number"
              variant="outlined"
              value={formData.discount}
              onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
              InputProps={{
                sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 } }}>
          <Button onClick={handleDialogClose}>
            {t("lot_cancel", lang)}
          </Button>
          <Button onClick={handleSave} variant="contained">
            {t("lot_save", lang)}
          </Button>
        </DialogActions>
      </Dialog>      {/* Image Crop Dialog */}
      <Dialog open={cropDialogOpen} onClose={handleCropDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>{t("lot_cropImage", lang)}</DialogTitle>
        <DialogContent>
          {tempImage && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={300 / 200}
              minWidth={100}
              minHeight={67}
            >
              <img
                ref={imgRef}
                src={tempImage}
                style={{ maxWidth: '100%', maxHeight: '400px' }}
              />
            </ReactCrop>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCropDialogClose}>
            {t("lot_cancel", lang)}
          </Button>
          <Button onClick={handleCropSave} variant="contained">
            {t("lot_save", lang)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteDialogClose}>
        <DialogTitle>{t("lot_deleteLot", lang)}</DialogTitle>
        <DialogContent>
          <Typography>
            {t("lot_confirmDelete", lang)}
          </Typography>
          {deletingLot && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              "{deletingLot.name}"
            </Typography>
          )}
        </DialogContent>        <DialogActions>
          <Button onClick={handleDeleteDialogClose}>
            {t("lot_cancel", lang)}
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            {t("lot_delete", lang)}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
