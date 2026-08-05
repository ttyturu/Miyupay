interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

// A fixed set of on-brand colour pairs — deterministic per name, not random,
// so the same person always gets the same colour across the app.
const PALETTE = [
  'bg-secondary/15 text-secondary',
  'bg-accent/15 text-accent',
  'bg-primary/10 text-primary',
  'bg-success/15 text-success',
  'bg-warning/15 text-warning',
  'bg-destructive/15 text-destructive',
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getColorClass = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

export default function Avatar({ name, size = 32, className = '' }: AvatarProps) {
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-semibold ${getColorClass(name)} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
