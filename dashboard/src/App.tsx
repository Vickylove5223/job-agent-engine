import { HashRouter, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/ui";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/overview/Overview";
import { Jobs } from "@/pages/jobs/Jobs";
import { Questions } from "@/pages/questions/Questions";
import { Profile } from "@/pages/profile/Profile";
import { Applications } from "@/pages/applications/Applications";
import { Settings } from "@/pages/settings/Settings";
import { Onboarding } from "@/pages/onboarding/Onboarding";
import { useDoc } from "@/lib/db";

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingBlock />;
  if (!user) return <Login />;
  // Remount everything when the account changes so no data leaks between users.
  return <SignedIn key={user.uid} />;
}

function SignedIn() {
  const { data: settings, loading } = useDoc("settings", "main");
  if (loading) return <LoadingBlock />;
  // New accounts go through the setup wizard first.
  if (!settings?.onboardedAt) return <Onboarding />;
  return (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="questions" element={<Questions />} />
          <Route path="applications" element={<Applications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Overview />} />
        </Route>
      </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}
