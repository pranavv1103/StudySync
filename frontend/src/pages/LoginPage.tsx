import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { requestGoogleIdToken } from '../lib/googleAuth';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleSignInAvailable = Boolean(googleClientId);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!googleClientId) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const idToken = await requestGoogleIdToken(googleClientId);
      const response = await api.loginWithGoogle({
        idToken,
        workspaceSlug: 'my-accountability-circle',
      });
      setAuth(response.token, response.user);
      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to login with Google.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.login({
        email,
        password,
        workspaceSlug: 'my-accountability-circle',
      });

      setAuth(response.token, response.user);
      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(140deg,#dbeafe_0%,#eff6ff_45%,#f8fafc_100%)] p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white/90 p-7 shadow-[0_24px_80px_-46px_rgba(2,6,23,0.6)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">StudySync</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">
          Login to track your goals and stay aligned with your accountability buddy.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-sky-200 transition focus:ring"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-sky-200 transition focus:ring"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
            disabled={loading || !googleSignInAvailable}
          >
            {googleSignInAvailable ? 'Continue with Google' : 'Google sign-in unavailable'}
          </button>

          {!googleSignInAvailable ? (
            <p className="text-xs text-slate-500">
              Google sign-in is disabled for this environment.
            </p>
          ) : null}
        </form>

        <p className="mt-4 text-sm text-slate-600">
          New here?{' '}
          <Link className="font-semibold text-sky-700" to="/signup">
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}
