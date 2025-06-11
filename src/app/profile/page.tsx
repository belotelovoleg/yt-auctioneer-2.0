"use client";

import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { t } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";

interface UserProfile {
  id: number;
  login: string;
  youtubeChannelId: string | null;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    youtubeChannelId: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    
    if (user) {
      fetchProfile();
    }
  }, [user, loading, router]);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const response = await fetch('/api/users/profile');
      
      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
        setFormData({
          youtubeChannelId: profileData.youtubeChannelId || "",
        });
      } else {
        throw new Error('Failed to fetch profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setAlertMessage({
        type: "error",
        message: "Failed to load profile",
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      // Validate password fields
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        setAlertMessage({
          type: "error",
          message: t("profile_passwordRequired", lang),
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setAlertMessage({
          type: "error",
          message: t("profile_passwordMismatch", lang),
        });
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setAlertMessage({
          type: "error",
          message: t("profile_passwordTooShort", lang),
        });
        return;
      }

      setChangingPassword(true);
      const response = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        setAlertMessage({
          type: "success",
          message: t("profile_passwordUpdated", lang),
        });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const errorData = await response.json();
        setAlertMessage({
          type: "error",
          message: errorData.error || "Failed to change password",
        });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setAlertMessage({
        type: "error",
        message: "Failed to change password",
      });    } finally {
      setChangingPassword(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setAlertMessage({
          type: "success",
          message: t("profile_updated", lang),
        });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setAlertMessage({
        type: "error",
        message: "Failed to update profile",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user || loadingProfile) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("profile_title", lang)}
      </Typography>

      {alertMessage && (
        <Alert 
          severity={alertMessage.type} 
          sx={{ mb: 2 }}
          onClose={() => setAlertMessage(null)}
        >
          {alertMessage.message}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t("profile_settings", lang)}
          </Typography>

          <TextField
            margin="dense"
            label="Login"
            fullWidth
            variant="outlined"
            value={profile?.login || ""}
            disabled
            sx={{ mb: 2 }}
          />          <TextField
            margin="dense"
            label={t("profile_youtubeChannelId", lang)}
            fullWidth
            variant="outlined"
            value={formData.youtubeChannelId}
            onChange={(e) => setFormData({ ...formData, youtubeChannelId: e.target.value })}
            helperText={t("profile_youtubeChannelIdHelper", lang)}
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving && <CircularProgress size={20} />}
            sx={{ mb: 4 }}
          >
            {t("profile_save", lang)}
          </Button>

          {/* Password Change Section */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            {t("profile_changePassword", lang)}
          </Typography>

          <TextField
            margin="dense"
            label={t("profile_currentPassword", lang)}
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label={t("profile_newPassword", lang)}
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label={t("profile_confirmPassword", lang)}
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
            sx={{ mb: 3 }}
          />

          <Button
            variant="outlined"
            onClick={handleChangePassword}
            disabled={changingPassword}
            startIcon={changingPassword && <CircularProgress size={20} />}
          >
            {t("profile_changePassword", lang)}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
