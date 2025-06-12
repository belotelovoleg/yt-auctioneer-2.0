"use client";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Typography, 
  Paper, 
  Chip, 
  Container,
  Fade,
  Stack
} from "@mui/material";
import { 
  YouTube as YouTubeIcon,
  Gavel as GavelIcon,
  TrendingUp as TrendingUpIcon
} from "@mui/icons-material";

export default function Home() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Fetch version from package.json
    fetch('/api/version')
      .then(res => res.json())
      .then(data => setVersion(data.version))
      .catch(() => setVersion("2.0.1")); // fallback
  }, []);

  if (loading || !user) return null;

  return (
    <Container maxWidth="lg">
      <Fade in timeout={1000}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="calc(100vh - 120px)"
          sx={{ py: 4 }}
        >
          {/* Hero Section */}
          <Paper
            elevation={8}
            sx={{
              p: 6,
              textAlign: "center",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: 4,
              mb: 4,
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"50\" cy=\"50\" r=\"1\" fill=\"%23ffffff\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>')",
                opacity: 0.3,
              }
            }}
          >
            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" mb={3}>
                <YouTubeIcon sx={{ fontSize: 48 }} />
                <GavelIcon sx={{ fontSize: 48 }} />
                <TrendingUpIcon sx={{ fontSize: 48 }} />
              </Stack>
              
              <Typography 
                variant="h2" 
                component="h1" 
                sx={{
                  fontWeight: 800,
                  background: "linear-gradient(45deg, #ffffff 30%, #f0f0f0 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 2,
                  letterSpacing: "-0.02em"
                }}
              >
                {t("app_name", lang)}
              </Typography>
              
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 300, 
                  opacity: 0.9,
                  mb: 3
                }}
              >
                {t("app_description", lang)}
              </Typography>

              <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
                <Chip 
                  label={`v${version}`}
                  sx={{ 
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 600,
                    backdropFilter: "blur(10px)"
                  }}
                />
                <Chip 
                  label="Production Ready"
                  sx={{ 
                    backgroundColor: "rgba(76, 175, 80, 0.8)",
                    color: "white",
                    fontWeight: 600
                  }}
                />
                <Chip 
                  label="Secure Database"
                  sx={{ 
                    backgroundColor: "rgba(33, 150, 243, 0.8)",
                    color: "white",
                    fontWeight: 600
                  }}
                />
              </Stack>
            </Box>
          </Paper>

          {/* Welcome Section */}
          <Paper
            elevation={2}
            sx={{
              p: 4,
              textAlign: "center",
              borderRadius: 3,
              width: "100%",
              maxWidth: 600
            }}
          >
            <Typography variant="h4" mb={2} color="primary">
              {t("auth_welcome", lang, { login: user.login })}
            </Typography>            <Typography variant="body1" color="text.secondary" sx={{ fontSize: "1.1rem" }}>
              {t("home_welcome", lang)}
            </Typography>
          </Paper>
        </Box>
      </Fade>
    </Container>
  );
}
