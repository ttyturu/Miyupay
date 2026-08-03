interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
}

export default function Logo({ variant = 'full', className = '' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center overflow-hidden ${className || 'h-8 w-10'}`}>
        <img src="/miyupay.png" alt="MiyuPay" className="block h-full w-auto max-w-none" />
      </span>
    );
  }

  return <img src="/miyupay.png" alt="MiyuPay" className={className || 'h-8 w-auto'} />;
}
