import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react';

interface PasswordStrengthMeterProps {
  password: string;
}

const REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Upper and lowercase letters', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'At least one number', test: (p: string) => /\d/.test(p) },
];

const scorePassword = (password: string): number =>
  REQUIREMENTS.filter(r => r.test(password)).length;

const LEVELS = [
  { label: 'Very weak', color: 'bg-destructive' },
  { label: 'Weak',      color: 'bg-destructive' },
  { label: 'Fair',      color: 'bg-warning' },
  { label: 'Strong',    color: 'bg-success' },
];

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? level.color : 'bg-muted'}`} />
        ))}
      </div>
      <p className="text-sm text-muted-foreground mt-1 mb-1.5">{level.label}</p>
      <ul className="space-y-0.5">
        {REQUIREMENTS.map(req => {
          const met = req.test(password);
          return (
            <li key={req.label} className={`flex items-center gap-1.5 text-sm ${met ? 'text-success' : 'text-muted-foreground'}`}>
              {met
                ? <CheckCircleIcon size={14} weight="fill" />
                : <CircleIcon size={14} />}
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
