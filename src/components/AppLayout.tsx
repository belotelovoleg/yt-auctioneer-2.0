'use client';

import { Box } from '@mui/material';
import Navbar from '@/components/Navbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <Box>
      <Navbar />
      <Box component="main">
        {children}
      </Box>
    </Box>
  );
}
