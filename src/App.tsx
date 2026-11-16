
import React, { useState, useEffect, useRef } from 'react';
import MatchAnalysis from './components/MatchAnalysis';
import Login from './components/auth/Login';
import UserManagement from './components/admin/UserManagement';
import { User } from './types';
import { ArrowLeft } from 'lucide-react';
import { supabase } from './lib/supabase';
import { loadFromSupabase, forceSyncToSupabase } from './services/supabaseStorage';
import { syncFromServer, cleanupStoredDuplicates, initStorageAndCacheCombined } from './services/storage';
import { MLMatrixProvider } from './context/MLMatrixContext';

function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms: number, name: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${name} took more than ${ms}ms`)), ms))
  ]);
}

class SafeErrorBoundary extends React.Component<
  { fallback: (error: Error, reset: () => void) => React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback: (error: Error, reset: () => void) => React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App Root Error Caught by SafeErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, () => this.setState({ hasError: false, error: null }));
    }
    return this.props.children;
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('prm_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse initial user profile from storage", e);
    }
    return null;
  });

  const [currentView, setCurrentView] = useState<'app' | 'admin'>('app');
  const [isAuthReady, setIsAuthReady] = useState(() => !!currentUser);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasSyncedRef = useRef(false);

  // Background Data Sync Decoupled From Auth State
  useEffect(() => {
    if (currentUser && !(currentUser as any).isBlocked && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      (async () => {
        try {
          await withTimeout(initStorageAndCacheCombined(), 10000, "initStorageAndCacheCombined");
          await withTimeout(loadFromSupabase(), 20000, "loadFromSupabase");
          // Defer heavy deduplication & LZString compression so UI & Live Analysis mount smoothly without blocking
          setTimeout(async () => {
            try {
              await withTimeout(cleanupStoredDuplicates(), 15000, "cleanupStoredDuplicates");
            } catch (dupErr) {
              console.warn("Deferred cleanup notice:", dupErr);
            }
          }, 6000);
        } catch (syncErr) {
          console.warn("Background data sync notice:", syncErr);
        }
      })();
    }
  }, [currentUser]);

  // Auth Session Handler
  useEffect(() => {
    let active = true;

    const handleSession = async (session: any, authEvent?: string) => {
      if (authEvent === 'SIGNED_OUT') {
        if (active) {
          try {
            localStorage.removeItem('prm_user_profile');
          } catch (e) {}
          setCurrentUser(null);
          setIsAuthReady(true);
          hasSyncedRef.current = false;
        }
        return;
      }

      if (session && session.user) {
        const user = session.user;
        let userData: User | null = null;

        // Try reading cached profile first
        try {
          const cached = localStorage.getItem('prm_user_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id === user.id) {
              userData = parsed;
            }
          }
        } catch (e) {}

        if (userData && active) {
          setCurrentUser(userData);
          setIsAuthReady(true);
        }

        try {
          // Fetch updated user from DB
          let freshUserData: User | null = null;
          try {
            const { data: dbUser, error: dbErr } = await withTimeout(
              supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
              10000,
              "Supabase fetch user"
            ) as any;

            if (!dbErr && dbUser) {
              freshUserData = {
                id: dbUser.id,
                name: dbUser.name,
                username: dbUser.username,
                phone: dbUser.phone || '',
                role: dbUser.role as any,
                branch: dbUser.branch || '',
                email: dbUser.email || '',
                status: (dbUser.status as any) || 'Active',
                regDate: dbUser.reg_date || ''
              };
            } else if (!dbUser) {
              freshUserData = {
                id: user.id,
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || "User",
                username: user.email?.split('@')[0] || "User",
                phone: user.phone || "N/A",
                role: (user.email === "jose.mfavour@gmail.com" || user.email === "josephmgathoni@gmail.com") ? "Super Admin" : "User",
                email: user.email || "",
                status: "Active",
                regDate: new Date().toISOString().split("T")[0],
              };

              await withTimeout(
                supabase.from('users').insert({
                  id: freshUserData.id,
                  name: freshUserData.name,
                  username: freshUserData.username,
                  phone: freshUserData.phone || '',
                  role: freshUserData.role,
                  branch: freshUserData.branch || '',
                  email: freshUserData.email || '',
                  status: freshUserData.status,
                  reg_date: freshUserData.regDate,
                  updated_at: new Date().toISOString()
                }),
                10000,
                "Supabase insert user"
              );
            }
          } catch (fetchError) {
            console.warn("Could not fetch user profile from cloud, using session data:", fetchError);
          }

          if (!freshUserData && !userData) {
            freshUserData = {
              id: user.id,
              name: user.user_metadata?.full_name || user.email?.split('@')[0] || "User",
              username: user.email?.split('@')[0] || "User",
              phone: user.phone || '',
              role: (user.email === "jose.mfavour@gmail.com" || user.email === "josephmgathoni@gmail.com") ? "Super Admin" : "User",
              branch: '',
              email: user.email || '',
              status: 'Active',
              regDate: new Date().toISOString().split("T")[0],
            };
          }

          const finalUser = freshUserData || userData;
          if (finalUser && active) {
            try {
              localStorage.setItem('prm_user_profile', JSON.stringify(finalUser));
            } catch (e) {}

            if (finalUser.status === 'Inactive') {
              setCurrentUser({ ...finalUser, isBlocked: true } as any);
            } else {
              setCurrentUser(finalUser);
            }
            setIsAuthReady(true);
          }
        } catch (err) {
          console.warn("Non-fatal session handling notice:", err);
          if (active) setIsAuthReady(true);
        }
      } else {
        // Session is null
        if (active) {
          // ONLY clear user if there is no cached user in storage or event is SIGNED_OUT
          const cached = localStorage.getItem('prm_user_profile');
          if (!cached || authEvent === 'SIGNED_OUT') {
            setCurrentUser(null);
          }
          setIsAuthReady(true);
        }
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        handleSession(session, event);
      });
      
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        console.log("getSession returned! error:", error, "session:", !!session);
        if (error) {
          console.warn("Error fetching initial session:", error);
          if (active) setIsAuthReady(true);
        } else {
          handleSession(session, 'INITIAL_SESSION');
        }
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }, []);

  const handleLogin = (user: User) => {
    try {
      localStorage.setItem('prm_user_profile', JSON.stringify(user));
    } catch (e) {}
    setCurrentUser(user);
    setIsAuthReady(true);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('prm_user_profile');
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setCurrentUser(null);
      setCurrentView('app');
      hasSyncedRef.current = false;
    }
  };

  // Inactivity & Sync Logic
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Attempt to sync one last time before leaving
      forceSyncToSupabase();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Run once

  if (!isAuthReady || isSyncing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-[0_0_40px_hsl(163_66%_51%_/_0.5)] animate-pulse-glow">
          <div className="h-6 w-6 rounded-full border-2 border-[var(--color-primary-foreground)]/40 border-t-[var(--color-primary-foreground)] animate-spin" />
        </div>
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {isSyncing ? "Syncing data from cloud…" : "Loading SEER.AI…"}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if ((currentUser as any).isBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--color-background)] p-4 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-600 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Account Suspended</h1>
        <p className="text-[var(--color-muted-foreground)] max-w-sm mb-4">
          Your account has been deactivated. Please contact your administrator if you believe this is a mistake.
        </p>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]/90"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <MLMatrixProvider>
      {currentView === 'admin' ? (
        <div className="min-h-screen">
          <div className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/80 px-4 py-3 backdrop-blur-xl">
            <button
              onClick={() => setCurrentView('app')}
              className="flex items-center gap-2 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-primary)]"
            >
              <ArrowLeft size={18} /> Back to App
            </button>
            <div className="flex items-center gap-4">
              <span className="hidden text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)] md:inline">
                Logged in as {currentUser.username}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs font-bold text-[var(--color-destructive)] transition-opacity hover:opacity-80"
              >
                Logout
              </button>
            </div>
          </div>
          <UserManagement currentUser={currentUser} />
        </div>
      ) : (
        <SafeErrorBoundary
          fallback={(error, reset) => (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--color-background)] p-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h1 className="text-xl font-bold text-white">Application Notice</h1>
              <p className="text-slate-400 max-w-md text-sm">
                A temporary error occurred while rendering the workspace. Click below to reload cleanly.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={reset}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Reload View
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Hard Refresh
                </button>
              </div>
            </div>
          )}
        >
          <MatchAnalysis
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigateAdmin={() => setCurrentView('admin')}
          />
        </SafeErrorBoundary>
      )}
    </MLMatrixProvider>
  );
}


export default App;