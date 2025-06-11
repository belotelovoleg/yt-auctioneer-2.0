"use client";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t } from "@/lib/i18n";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";

export default function Home() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="calc(100vh - 64px)"
      sx={{ p: 2 }}
    >
      <Typography variant="h4" mb={2}>
        {t("auth_welcome", lang, { login: user.login })}
      </Typography>
      <Typography variant="body1" align="center" sx={{ mb: 4 }}>
        Welcome to the auction platform!
      </Typography>
    </Box>
  );
}
