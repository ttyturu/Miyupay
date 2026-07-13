interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
}

export default function Logo({ variant = 'full', className = '' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <span className={`inline-block overflow-hidden ${className || 'h-8 w-9'}`}>
        <img src="/miyupay.png" alt="MiyuPay" className="h-full w-auto max-w-none" />
      </span>
    );
  }

  return <img src="/miyupay.png" alt="MiyuPay" className={className || 'h-8 w-auto'} />;
}
