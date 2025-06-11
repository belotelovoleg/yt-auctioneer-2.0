"use client";

import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t, Lang } from "@/lib/i18n";
import { useState, useEffect, useMemo } from "react";
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
  Chip,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
} from "@mui/icons-material";

interface Lot {
  id: number;
  name: string;
  description: string;
  photo?: string;
  startingPrice: number;
  finalPrice?: number;
  status: string;
}

interface AuctionLot {
  id: number;
  order: number;
  lot: Lot;
}

interface Bid {
  id: number;
  bidderName: string;
  amount: number;
  source: string;
  status: string;
  isWinning: boolean;
  createdAt: string;
  lot: Lot;
}

interface Auction {
  id: number;
  name: string;
  status: string;
  auctionLots: AuctionLot[];
}

interface AuctionResults {
  auction: Auction;
  soldLots: AuctionLot[];
  winningBids: Bid[];
  totalSoldLots: number;
  totalBids: number;
  totalRevenue: number;
  uniqueBidders: number;
  buyerSummary: {
    bidderName: string;
    totalSpent: number;
    lotsWon: number;
    bids: Bid[];
  }[];
}

type SortDirection = 'asc' | 'desc';
type SortField = 'bidderName' | 'lotName' | 'finalPrice' | 'source' | 'createdAt';

export default function AuctionResultsPage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const auctionId = parseInt(params.id as string);

  const [results, setResults] = useState<AuctionResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering and sorting
  const [bidderFilter, setBidderFilter] = useState<string>('');
  const [selectedBuyer, setSelectedBuyer] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('finalPrice');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    
    if (user) {
      fetchResults();
    }
  }, [user, loading, router, auctionId]);

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/results`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data);      } else if (response.status === 404) {
        setError(t('auctionResults_notFound', lang));
      } else {
        setError(t('auctionResults_loadError', lang));
      }
    } catch (error) {
      console.error("Failed to fetch auction results:", error);
      setError(t('auctionResults_loadError', lang));
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered and sorted winning bids
  const filteredAndSortedBids = useMemo(() => {
    if (!results) return [];
    
    let filtered = results.winningBids;
    
    // Apply bidder filter
    if (bidderFilter) {
      filtered = filtered.filter(bid => 
        bid.bidderName.toLowerCase().includes(bidderFilter.toLowerCase())
      );
    }
    
    // Sort
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'bidderName':
          aValue = a.bidderName;
          bValue = b.bidderName;
          break;
        case 'lotName':
          aValue = a.lot.name;
          bValue = b.lot.name;
          break;
        case 'finalPrice':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'source':
          aValue = a.source;
          bValue = b.source;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, bidderFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount: number): string => {
    return amount.toFixed(0);
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/export/excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerName: selectedBuyer || undefined,
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auction-${auctionId}-results${selectedBuyer ? `-${selectedBuyer}` : ''}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting Excel:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/export/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerName: selectedBuyer || undefined,
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auction-${auctionId}-results${selectedBuyer ? `-${selectedBuyer}` : ''}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  if (loading || !user || isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          {t('auctionResults_back', lang)}
        </Button>
      </Box>
    );
  }

  if (!results) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('auctionResults_noResults', lang)}</Alert>
      </Box>
    );
  }

  const totalRevenue = filteredAndSortedBids.reduce((sum, bid) => sum + Number(bid.amount), 0);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => router.back()} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>          <Typography variant="h4" component="h1">
            {t('auctionResults_title', lang)}: {results.auction.name}
          </Typography>
        </Box>
      </Box>      {/* Summary Cards */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 3,
        mb: 4 
      }}>        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              {t('auctionResults_lotsSold', lang)}
            </Typography>
            <Typography variant="h4" color="primary">
              {results.totalSoldLots}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              {t('auctionResults_totalRevenue', lang)}
            </Typography>
            <Typography variant="h4" color="success.main">
              {formatCurrency(results.totalRevenue)}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              {t('auctionResults_totalBids', lang)}
            </Typography>
            <Typography variant="h4" color="info.main">
              {results.totalBids}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              {t('auctionResults_uniqueBidders', lang)}
            </Typography>
            <Typography variant="h4" color="warning.main">
              {results.uniqueBidders}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters and Export */}      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('auctionResults_filtersExport', lang)}
        </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label={t('auctionResults_filterByBidder', lang)}
              value={bidderFilter}
              onChange={(e) => setBidderFilter(e.target.value)}
              placeholder={t('auctionResults_enterBidderName', lang)}
            />
          </Box>
          
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth>
              <InputLabel>{t('auctionResults_selectBuyerExport', lang)}</InputLabel>
              <Select
                value={selectedBuyer}
                label={t('auctionResults_selectBuyerExport', lang)}
                onChange={(e) => setSelectedBuyer(e.target.value)}
              >
                <MenuItem value="">{t('auctionResults_allBuyers', lang)}</MenuItem>
                {results.buyerSummary.map((buyer) => (
                  <MenuItem key={buyer.bidderName} value={buyer.bidderName}>
                    {buyer.bidderName} ({buyer.lotsWon} {t('auctionResults_lots', lang)}, {formatCurrency(buyer.totalSpent)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              variant="contained"
              startIcon={<ExcelIcon />}
              onClick={handleExportExcel}
              color="success"
            >
              {t('auctionResults_excel', lang)}
            </Button>
            <Button
              variant="contained"
              startIcon={<PdfIcon />}
              onClick={handleExportPDF}
              color="error"
            >
              {t('auctionResults_pdf', lang)}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Results Table */}
      <Paper>        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t('auctionResults_winningBids', lang)} ({filteredAndSortedBids.length} {t('auctionResults_items', lang)}, {t('auctionResults_total', lang)}: {formatCurrency(totalRevenue)})
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'bidderName'}
                    direction={sortField === 'bidderName' ? sortDirection : 'asc'}
                    onClick={() => handleSort('bidderName')}
                  >
                    {t('auctionResults_bidderName', lang)}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'lotName'}
                    direction={sortField === 'lotName' ? sortDirection : 'asc'}
                    onClick={() => handleSort('lotName')}
                  >
                    {t('auctionResults_lotName', lang)}
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'finalPrice'}
                    direction={sortField === 'finalPrice' ? sortDirection : 'asc'}
                    onClick={() => handleSort('finalPrice')}
                  >
                    {t('auctionResults_finalPrice', lang)}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'source'}
                    direction={sortField === 'source' ? sortDirection : 'asc'}
                    onClick={() => handleSort('source')}
                  >
                    {t('auctionResults_source', lang)}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'createdAt'}
                    direction={sortField === 'createdAt' ? sortDirection : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    {t('auctionResults_date', lang)}
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedBids.map((bid) => (
                <TableRow key={bid.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {bid.bidderName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {bid.lot.name}
                    </Typography>
                    {bid.lot.description && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {bid.lot.description.slice(0, 50)}...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {formatCurrency(bid.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={bid.source} 
                      size="small" 
                      color={bid.source === 'MANUAL' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(bid.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(bid.createdAt).toLocaleTimeString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
