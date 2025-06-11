"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TextField, Button, Box, Typography, Alert, InputAdornment, IconButton, Paper } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t } from "@/lib/i18n";

export default function RegisterPage() {
  const { user, register, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle redirect for authenticated users
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // Don't render the form if user is already authenticated
  if (!loading && user) {
    return null;
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(loginValue, password);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="calc(100vh - 64px)" sx={{ p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, minWidth: 350 }}>        <Typography variant="h5" mb={2} align="center">
          {t("auth_register", lang)}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{t("auth_errorRegistrationFailed", lang)}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            label={t("auth_login", lang)}
            value={loginValue}            onChange={e => setLoginValue(e.target.value)}
            fullWidth
            margin="normal"
            required
            autoFocus
          />
          <TextField
            label={t("auth_password", lang)}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth
            margin="normal"
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((show) => !show)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<PersonAddIcon />}
            sx={{ mt: 2 }}            disabled={loading}
          >
            {t("auth_registerButton", lang)}
          </Button>
        </form>
        <Box mt={2} textAlign="center">
          <Button color="secondary" onClick={() => router.push("/login")}>{t("auth_backToLogin", lang)}</Button>
        </Box>
      </Paper>
    </Box>
  );
}
