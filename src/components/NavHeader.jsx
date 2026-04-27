import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

const NAV_LINKS = [
  { href: '/resume', label: 'Resume' },
  {
    label: 'Projects',
    children: [
      { href: '/basketball-platform', label: 'Basketball Data Platform' },
      { href: '/posts/pente', label: 'Pente' },
      { href: '/posts/pente-puzzles', label: 'Pente Puzzles' },
      { href: '/posts/go', label: 'Go' },
      { href: '/posts/nanu-pika-td', label: 'Nanu & Pika TD' },
    ],
  },
  { href: '/consulting', label: 'Services' },
  { href: 'https://github.com/brooksroley', label: 'GitHub', external: true },
  { href: '/zero-paradox', label: 'Support' },
  { href: '/intake', label: 'Contact' },
];

export default function NavHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = () => {
      setMobileOpen(false);
      setDropdownOpen(false);
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href) => router.pathname === href;

  return (
    <nav className="sticky top-0 z-50 bg-forest-900/90 backdrop-blur-md border-b border-forest-700/40 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        {/* Logo / Home */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/BRLogoTransparent.png"
            alt="Brooks Roley"
            width={100}
            height={40}
            className="w-auto brightness-0 invert"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((item) =>
            item.children ? (
              <li key={item.label} className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${item.children.some((c) => isActive(c.href))
                      ? 'text-candy-400 bg-forest-800'
                      : 'text-forest-100 hover:text-candy-300 hover:bg-forest-800'
                    }`}
                >
                  {item.label}
                  <svg
                    className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {dropdownOpen && (
                  <ul className="absolute top-full right-0 mt-1 w-48 bg-forest-800 rounded-lg shadow-lg border border-forest-700/60 py-1 animate-[fadeIn_0.15s_ease-out]">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`block px-4 py-2 text-sm transition-colors
                            ${isActive(child.href)
                              ? 'text-candy-400 bg-forest-700'
                              : 'text-forest-100 hover:text-candy-300 hover:bg-forest-700'
                            }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ) : (
              <li key={item.href}>
                <Link
                  href={item.href}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive(item.href)
                      ? 'text-candy-400 bg-forest-800'
                      : 'text-forest-100 hover:text-candy-300 hover:bg-forest-800'
                    }`}
                >
                  {item.label}
                  {item.external && (
                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </Link>
              </li>
            )
          )}
        </ul>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden p-2 rounded-md text-forest-100 hover:bg-forest-800 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-forest-700/40 bg-forest-900/95 backdrop-blur-md animate-slide-down overflow-hidden">
          <ul className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((item) =>
              item.children ? (
                <li key={item.label}>
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-forest-400">
                    {item.label}
                  </p>
                  <ul className="ml-3 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors
                            ${isActive(child.href)
                              ? 'text-candy-400 bg-forest-800'
                              : 'text-forest-100 hover:text-candy-300 hover:bg-forest-800'
                            }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive(item.href)
                        ? 'text-candy-400 bg-forest-800'
                        : 'text-forest-100 hover:text-candy-300 hover:bg-forest-800'
                      }`}
                  >
                    {item.label}
                    {item.external && (
                      <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </nav>
  );
}
