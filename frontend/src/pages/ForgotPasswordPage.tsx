import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, WarningCircleIcon, KeyIcon } from '@phosphor-icons/react';
import { authService } from '../services/api';
import Logo from '../components/ui/Logo';
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mocked password reset — no real email is sent for this demo, the code is
  // returned directly from the forgot-password call and shown on screen.
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email);
      setResetCode(data.resetCode);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not request a reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetting(true);
    try {
      await authService.resetPassword({ email, code: codeInput, newPassword });
      navigate('/login');
    } catch (err: any) {
      setResetError(err.response?.data?.error || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/">
            <Logo className="h-14 w-auto mb-4" />
          </Link>
          <p className="text-base text-muted-foreground">Reset your password</p>
        </div>
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <form onSubmit={handleRequestCode} className="space-y-3" noValidate>
            <div>
              <label htmlFor="forgot-email" className="block text-base font-medium text-muted-foreground mb-1">
                Email
              </label>
              <input
                id="forgot-email"
                type="email" required placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-base text-destructive">
                <WarningCircleIcon size={14} weight="fill" /> {error}
              </p>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
            >
              {loading ? 'Sending code…' : 'Send reset code'}
            </button>
          </form>
          <p className="text-center text-base text-muted-foreground mt-4">
            Remember your password?{' '}
            <Link to="/login" className="text-primary font-semibold">Sign in</Link>
          </p>
        </div>
      </div>

      {resetCode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
              <KeyIcon size={26} weight="fill" className="text-secondary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Reset your password</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This is a demo, so no real email was sent — here's your reset code:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 text-center mb-4">
              <span className="text-2xl font-mono font-bold tracking-widest text-foreground">{resetCode}</span>
            </div>
            <form onSubmit={handleReset} className="space-y-3">
              <input
                type="text" inputMode="numeric" maxLength={6} placeholder="Enter the 6-digit code" required
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="New password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border border-border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showPassword ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>
              {resetError && (
                <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                  <WarningCircleIcon size={14} weight="fill" /> {resetError}
                </p>
              )}
              <button
                type="submit" disabled={resetting || codeInput.length !== 6 || newPassword.length < 8}
                className="w-full bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {resetting ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
