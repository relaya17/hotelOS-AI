import { useEffect, useRef, type ReactNode } from "react";

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function RevealSection({
  id,
  className,
  children,
  "aria-labelledby": labelledBy,
  tabIndex,
}: {
  readonly id: string;
  readonly className: string;
  readonly children: ReactNode;
  readonly "aria-labelledby": string;
  readonly tabIndex?: number;
}) {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      id={id}
      className={`reveal ${className}`}
      aria-labelledby={labelledBy}
      tabIndex={tabIndex}
    >
      {children}
    </section>
  );
}
