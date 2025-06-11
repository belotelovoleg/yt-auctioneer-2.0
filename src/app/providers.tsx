'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '@/lib/auth';
import { ThemeContextProvider, useTheme } from '@/lib/theme';
import { LanguageProvider } from '@/lib/language';

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme();

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: mode === 'dark' ? '#f48fb1' : '#dc004e',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#ffffff',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
    },
    typography: {
      fontSize: 13, // Default is 14, making it smaller
      h1: {
        fontSize: '2rem', // Default is 2.125rem
      },
      h2: {
        fontSize: '1.75rem', // Default is 1.875rem
      },
      h3: {
        fontSize: '1.5rem', // Default is 1.625rem
      },
      h4: {
        fontSize: '1.25rem', // Default is 1.375rem
      },
      h5: {
        fontSize: '1.125rem', // Default is 1.25rem
      },
      h6: {
        fontSize: '1rem', // Default is 1.125rem
      },
      subtitle1: {
        fontSize: '0.95rem', // Default is 1rem
      },
      subtitle2: {
        fontSize: '0.85rem', // Default is 0.875rem
      },
      body1: {
        fontSize: '0.875rem', // Default is 1rem
      },
      body2: {
        fontSize: '0.8rem', // Default is 0.875rem
      },
      button: {
        fontSize: '0.8rem', // Default is 0.875rem
      },
      caption: {
        fontSize: '0.7rem', // Default is 0.75rem
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#1976d2',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            fontSize: '0.8rem', // Smaller button text
            textTransform: 'none', // Optional: remove all caps
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontSize: '0.75rem', // Smaller chip text
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontSize: '0.8rem', // Smaller table text
          },
        },
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ThemeContextProvider>
        <ThemedApp>
          {children}
        </ThemedApp>
      </ThemeContextProvider>
    </LanguageProvider>
  );
}
