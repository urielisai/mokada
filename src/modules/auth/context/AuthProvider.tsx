import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase/client';
import { authService, type UpdateProfileInput, type UserProfile } from '../services/auth.service';
import { AuthContext, type AuthContextValue } from './AuthContextState';
import { queryClient } from '../../../app/config/queryClient';
import { useRouteStore } from '../../../store/routeStore';

// Cached queries and the persisted route filter belong to the previous user;
// drop them so a different user on the same device never sees that data.
const clearUserScopedState = () => {
  queryClient.clear();
  useRouteStore.getState().setGlobalSelectedRouteId('');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setProfile(null);
      return;
    }

    let nextProfile = null;
    try {
      nextProfile = await authService.getProfileByAuthUserId(nextSession.user.id);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // If there's a network error but we already have a session, DO NOT setProfile to null.
      // If we don't have a profile yet (initial load), we might want to flag an error state,
      // but for now, we will leave it as is to avoid destroying the session.
      // Retrying could be implemented here.
      throw error; // Throw so that the caller knows it failed.
    }

    if (!nextProfile) {
      // User has no profile in the database.
      setProfile(null);
      await authService.signOut();
      return;
    }

    if (!nextProfile.is_active) {
      // User is deactivated.
      setProfile(null);
      await authService.signOut();
      return;
    }

    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      try {
        await loadProfile(data.session);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Only process state changes if it's a significant event (like SIGNED_IN or TOKEN_REFRESHED)
      // and do not aggressively log out if the profile fetch fails (e.g. due to brief network drop).
      if (event === 'SIGNED_OUT') {
        clearUserScopedState();
        setProfile(null);
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        loadProfile(nextSession).catch((error) => {
          console.error('Error in onAuthStateChange profile load:', error);
          // Deliberately NOT calling signOut() here! If the token refreshed but the 
          // network dropped during the profile fetch, we should keep the user logged in.
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const authSession = await authService.signIn(email, password);
      clearUserScopedState();
      setSession(authSession.session);
      setProfile(authSession.profile);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    clearUserScopedState();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const nextProfile = await authService.getProfileByAuthUserId(session.user.id);
    setProfile(nextProfile);
  }, [session?.user]);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authService.updatePassword(currentPassword, newPassword);
  }, []);

  const updateAvatar = useCallback(
    async (file: File) => {
      if (!profile) {
        throw new Error('No hay perfil activo para actualizar.');
      }

      const nextProfile = await authService.updateAvatar(profile, file);
      setProfile(nextProfile);
    },
    [profile],
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!profile) {
        throw new Error('No hay perfil activo para actualizar.');
      }

      const nextProfile = await authService.updateProfile(profile, input);
      setProfile(nextProfile);
    },
    [profile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      isAdmin: profile?.user_type === 'ADMIN',
      signIn,
      signOut,
      updateAvatar,
      updateProfile,
      refreshProfile,
      updatePassword,
    }),
    [isLoading, profile, refreshProfile, session, signIn, signOut, updateAvatar, updatePassword, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
