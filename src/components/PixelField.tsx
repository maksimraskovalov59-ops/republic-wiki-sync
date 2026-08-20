const PIXELS = [
  { top: "8%", left: "12%", color: "var(--cyan)", size: 4, delay: "0s" },
  { top: "18%", left: "27%", color: "var(--magenta)", size: 5, delay: "0.6s" },
  { top: "31%", left: "6%", color: "var(--blue)", size: 3, delay: "1.2s" },
  { top: "44%", left: "21%", color: "var(--violet)", size: 4, delay: "0.3s" },
  { top: "62%", left: "9%", color: "var(--cyan)", size: 3, delay: "1.8s" },
  { top: "76%", left: "30%", color: "var(--magenta)", size: 4, delay: "0.9s" },
  { top: "12%", left: "68%", color: "var(--violet)", size: 4, delay: "1.4s" },
  { top: "26%", left: "84%", color: "var(--cyan)", size: 5, delay: "0.2s" },
  { top: "48%", left: "73%", color: "var(--magenta)", size: 3, delay: "1.1s" },
  { top: "58%", left: "92%", color: "var(--blue)", size: 4, delay: "0.7s" },
  { top: "71%", left: "62%", color: "var(--cyan)", size: 3, delay: "1.6s" },
  { top: "86%", left: "80%", color: "var(--violet)", size: 5, delay: "0.4s" },
  { top: "92%", left: "44%", color: "var(--magenta)", size: 3, delay: "1.3s" },
  { top: "37%", left: "50%", color: "var(--blue)", size: 3, delay: "2s" },
];

export function PixelField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% -10%, color-mix(in oklab, var(--blue) 22%, transparent), transparent 70%), radial-gradient(700px 480px at 90% 20%, color-mix(in oklab, var(--magenta) 14%, transparent), transparent 70%), radial-gradient(700px 480px at 5% 40%, color-mix(in oklab, var(--cyan) 12%, transparent), transparent 70%)",
        }}
      />
      {PIXELS.map((p, i) => (
        <span
          key={i}
          className="absolute animate-pulse"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 12px ${p.color}`,
            animationDelay: p.delay,
            animationDuration: "3.5s",
          }}
        />
      ))}
    </div>
  );
}