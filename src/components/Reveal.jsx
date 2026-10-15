import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from 'src/lib/motion';

// Content renders visible on the server and stays visible unless the browser can
// animate it in: crawlers, no-JS clients and reduced-motion visitors see it
// immediately. Only elements that start below the fold are hidden and revealed,
// so nothing already on screen flashes out and back in after hydration.
export default function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setHidden(true);
    setAnimated(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={animated ? {
        opacity: hidden ? 0 : 1,
        transform: hidden ? 'translateY(24px)' : 'translateY(0)',
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
      } : undefined}
    >
      {children}
    </div>
  );
}
