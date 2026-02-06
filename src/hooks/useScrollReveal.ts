import { useEffect, useRef } from "react";

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Small delay to ensure elements are rendered
    const timer = setTimeout(() => {
      const children = el.querySelectorAll(".scroll-reveal");

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: "50px 0px 0px 0px" }
      );

      children.forEach((child) => observer.observe(child));

      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return ref;
}
