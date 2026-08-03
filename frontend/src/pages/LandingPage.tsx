import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, ListIcon, XIcon } from '@phosphor-icons/react';
import Logo from '../components/ui/Logo';
import ParallaxVisual from '../components/ui/ParallaxVisual';
import RateTicker from '../components/ui/RateTicker';
import ScrollReveal from '../components/ui/ScrollReveal';
import VideoHeroBg from '../components/ui/VideoHeroBg';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Currencies', href: '#currencies' },
  { label: 'Security', href: '#security' },
];

const FEATURES = [
  { glyph: '→', label: 'Send', to: '/send' },
  { glyph: '⇄', label: 'Convert', to: '/convert' },
  { glyph: '≡', label: 'Track', to: '/transactions' },
];

const CURRENCIES = [
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden font-body">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 md:px-14 py-4 sm:py-5 flex items-center justify-between transition-shadow duration-300 ${scrolled || mobileMenuOpen ? 'bg-[#E7F4F2]' : 'bg-transparent'} ${scrolled ? 'shadow-[0_1px_0_rgba(15,23,42,0.08)]' : ''}`}
      >
        <a href="#" className="cursor-pointer">
          <Logo className="h-8 w-auto" />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-sm font-medium text-primary/70 hover:text-primary-light transition-colors duration-200 after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-primary-light after:origin-left after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden md:inline relative text-sm font-bold text-primary/70 hover:text-primary transition-colors duration-200 after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-primary after:origin-left after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="hidden md:inline-block px-5 py-2.5 bg-primary-light text-primary-foreground text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden p-1 text-primary"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <ListIcon className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 md:hidden bg-[#E7F4F2] shadow-[0_4px_12px_rgba(15,23,42,0.1)] px-6 py-5 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-primary"
              >
                {link.label}
              </a>
            ))}
            <div className="h-px bg-primary/10" />
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-bold text-primary"
            >
              Log in
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 inline-block w-fit px-5 py-2.5 bg-primary-light text-primary-foreground text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center overflow-hidden min-h-screen">
        <VideoHeroBg />

        <div className="relative z-10 flex flex-col items-center pt-28 sm:pt-32 md:pt-40 px-4 sm:px-6 text-center">
          <h1 className="font-heading text-4xl sm:text-5xl md:text-7xl leading-[1.1] tracking-tighter font-semibold">
            <span className="text-secondary">Send</span> <span className="text-primary-light">money,</span>
            <br />
            <span className="text-primary-light">without borders.</span>
          </h1>
          <p className="max-w-sm sm:max-w-md mt-5 sm:mt-6 md:mt-8 text-sm md:text-base text-primary/90 leading-relaxed">
            A multi-currency wallet for SGD, MYR, and THB — send, convert, and
            track every transfer with real-time exchange rates and full
            audit visibility.
          </p>
          <Link
            to="/register"
            className="mt-6 sm:mt-8 md:mt-10 mb-10 sm:mb-0 px-6 sm:px-8 py-3 sm:py-3.5 bg-primary-light text-primary-foreground text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Get Started
          </Link>
        </div>

        {/* Bottom info panel */}
        <div className="relative z-10 mt-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="bg-card/90 backdrop-blur-sm border border-border border-b-0 pt-8 sm:pt-12 md:pt-16 px-5 sm:px-8 md:px-12 pb-0 shadow-[0_-16px_40px_-12px_rgba(15,23,42,0.25)] rounded-t-lg">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-16">
              <div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-primary/50 font-medium">
                  What do we do?
                </span>
                <h2 className="font-heading mt-3 text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-primary">
                  <span className="text-4xl sm:text-5xl md:text-6xl text-secondary">Transfers</span> <span className="text-primary-light">that</span>
                  <br className="hidden sm:block" /> <span className="text-primary-light">move with you.</span>
                </h2>
              </div>
              <div className="flex items-end">
                <p className="text-sm md:text-[15px] text-primary/70 leading-relaxed">
                  Built for people moving money across Singapore, Malaysia,
                  and Thailand. Hold balances in every currency, convert at
                  transparent rates, and see a full audit trail on every
                  transaction.
                </p>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 md:mt-10 h-px bg-border w-full" />

            <div className="grid sm:grid-cols-3 gap-2 sm:gap-3 py-4 sm:py-6">
              {FEATURES.map((feature) => (
                <Link
                  key={feature.label}
                  to="/register"
                  className="group bg-muted hover:bg-muted/70 transition-all duration-200 cursor-pointer px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between rounded-lg"
                >
                  <span className="font-medium text-primary">
                    <span className="font-mono text-primary/40">{feature.glyph}</span>
                    <span className="ml-3">{feature.label}</span>
                  </span>
                  <ArrowRightIcon
                    className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RateTicker />

      {/* Features */}
      <section id="features" className="scroll-mt-24 grid md:grid-cols-2">
        <ScrollReveal className="bg-primary-light flex flex-col justify-center px-6 sm:px-10 md:px-16 py-16 md:py-24">
          <ScrollReveal delayMs={550}>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight text-white">
              Everything you need to move money.
            </h2>
            <p className="mt-6 max-w-md text-sm md:text-base text-white/70 leading-relaxed">
              Send to anyone by email, convert between currencies at
              transparent rates, and track every transfer from a single
              wallet.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-block w-fit px-6 py-3 bg-secondary text-white text-sm font-semibold rounded-full border-2 border-secondary hover:bg-transparent hover:text-secondary transition-colors duration-200"
            >
              Get Started
            </Link>
          </ScrollReveal>
        </ScrollReveal>

        <ScrollReveal className="relative bg-secondary flex items-center justify-center overflow-hidden min-h-[400px] md:min-h-[520px] p-10 md:p-16">
          <div
            className="absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage: 'url(/pattern1.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <ScrollReveal delayMs={700} className="relative z-10 w-full">
            <ParallaxVisual
              src="/phone1.png"
              alt="MiyuPay features"
              fit="contain"
              className="w-full h-64 sm:h-80 md:h-96"
            />
          </ScrollReveal>
        </ScrollReveal>
      </section>

      {/* Currencies */}
      <section id="currencies" className="scroll-mt-24 grid md:grid-cols-2">
        <ScrollReveal className="order-2 md:order-1 relative bg-secondary flex items-center justify-center overflow-hidden min-h-[400px] md:min-h-[520px] p-10 md:p-16">
          <div
            className="absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage: 'url(/pattern1.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              transform: 'scaleX(-1)',
            }}
          />
          <ScrollReveal delayMs={550} className="relative z-10 w-full">
            <ParallaxVisual
              src="/wallet1.png"
              alt="MiyuPay supported currencies"
              fit="contain"
              className="w-full h-80 sm:h-[26rem] md:h-[32rem]"
            />
          </ScrollReveal>
        </ScrollReveal>

        <ScrollReveal className="order-1 md:order-2 bg-primary-light flex flex-col justify-center px-6 sm:px-10 md:px-16 py-16 md:py-24">
          <ScrollReveal delayMs={700}>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight text-white">
              One wallet, multiple currencies.
            </h2>
            <p className="mt-6 max-w-md text-sm md:text-base text-white/70 leading-relaxed">
              Hold balances and convert between currencies with live rates,
              no separate accounts needed.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {CURRENCIES.map((currency) => (
                <div
                  key={currency.code}
                  className="px-4 py-2.5 bg-white/10 rounded-lg"
                >
                  <span className="font-mono font-medium text-white">{currency.code}</span>
                  <span className="ml-2 text-sm text-white/60">{currency.name}</span>
                </div>
              ))}
            </div>
            <Link
              to="/register"
              className="mt-8 inline-block w-fit px-6 py-3 bg-secondary text-white text-sm font-semibold rounded-full border-2 border-secondary hover:bg-transparent hover:text-secondary transition-colors duration-200"
            >
              Get Started
            </Link>
          </ScrollReveal>
        </ScrollReveal>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-24 grid md:grid-cols-2">
        <ScrollReveal className="bg-primary-light flex flex-col justify-center px-6 sm:px-10 md:px-16 py-16 md:py-24">
          <ScrollReveal delayMs={550}>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight text-white">
              Every transfer, fully accounted for.
            </h2>
            <p className="mt-6 max-w-md text-sm md:text-base text-white/70 leading-relaxed">
              Every transaction is logged with a complete audit trail, and
              suspicious activity is flagged automatically so you always
              know where your money went.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-block w-fit px-6 py-3 bg-secondary text-white text-sm font-semibold rounded-full border-2 border-secondary hover:bg-transparent hover:text-secondary transition-colors duration-200"
            >
              Get Started
            </Link>
          </ScrollReveal>
        </ScrollReveal>

        <ScrollReveal className="relative bg-secondary flex items-end justify-center overflow-hidden min-h-[400px] md:min-h-[520px] pt-10 md:pt-16 px-10 md:px-16 pb-0">
          <div
            className="absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage: 'url(/pattern1.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <ScrollReveal delayMs={700} className="relative z-10 w-full">
            <ParallaxVisual
              src="/security1.png"
              alt="MiyuPay security and audit trail"
              fit="contain"
              position="bottom"
              className="w-full h-80 sm:h-[26rem] md:h-[32rem]"
            />
          </ScrollReveal>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-4 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center gap-2">
          <span className="p-1.5 rounded-md bg-[#E7F4F2]">
            <Logo variant="icon" className="h-5 w-6 translate-y-0.5" />
          </span>
          <p className="text-xs text-primary-foreground/60">
            &copy; {new Date().getFullYear()} MiyuPay. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
