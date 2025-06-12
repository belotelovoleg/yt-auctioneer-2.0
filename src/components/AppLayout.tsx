'use client';

import { Box } from '@mui/material';
import Navbar from '@/components/Navbar';
import ScrollWrapper from '@/components/ScrollWrapper';
import { useEffect, useState } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  // Use state to ensure the ScrollWrapper is only rendered client-side
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      {mounted ? (
        <ScrollWrapper
          style={{ 
            height: 'calc(100vh - 64px)',  // Adjust based on navbar height
            width: '100%',
            overflow: 'auto'
          }}
        >
          <Box component="main">
            {children}
          </Box>
        </ScrollWrapper>
      ) : (
        <Box 
          component="main" 
          sx={{ 
            height: 'calc(100vh - 64px)', 
            overflow: 'auto' 
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
