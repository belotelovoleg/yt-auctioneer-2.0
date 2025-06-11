"use client";

import { useAuth } from "@/lib/auth";
import { t, Lang } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    
    // Get language from localStorage
    const savedLang = localStorage.getItem('language') as Lang;
    if (savedLang && (savedLang === 'en' || savedLang === 'uk')) {
      setLang(savedLang);
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <Box sx={{ p: 3 }}>      <Typography variant="h4" component="h1" gutterBottom>
        {t("nav_settings", lang)}
      </Typography>
      <Typography variant="body1">
        {lang === "en" 
          ? "Settings page coming soon..." 
          : "Сторінка налаштувань незабаром..."}
      </Typography>
    </Box>
  );
}
