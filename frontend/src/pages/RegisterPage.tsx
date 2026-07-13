import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { authService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/ui/Logo';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm]     = useState({ email: '', password: '', fullName: '', country: 'SGP' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.register(form);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="h-14 w-auto mb-4" />
          <p className="text-base text-muted-foreground">Create your account</p>
        </div>
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="reg-name" className="block text-base font-medium text-muted-foreground mb-1">
                Full name
              </label>
              <input
                id="reg-name"
                type="text" required placeholder="Alice Tan"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-base font-medium text-muted-foreground mb-1">
                Email
              </label>
              <input
                id="reg-email"
                type="email" required placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-base font-medium text-muted-foreground mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="Min 8 characters"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
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
            </div>
            <div>
              <label htmlFor="reg-country" className="block text-base font-medium text-muted-foreground mb-1">
                Country
              </label>
              <select
                id="reg-country"
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              >
                <option value="SGP">🇸🇬 Singapore</option>
                <option value="MYS">🇲🇾 Malaysia</option>
                <option value="THA">🇹🇭 Thailand</option>
              </select>
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-base text-muted-foreground mt-4">
            Have an account?{' '}
            <Link to="/login" className="text-primary font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
