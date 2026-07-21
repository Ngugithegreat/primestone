"use client";

import { motion } from "framer-motion";
import { ArrowRight, PlayCircle, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, AnimatedNumber, LiveDot } from "@/components/ui/Primitives";
import { useMarket } from "@/components/providers/MarketProvider";
import { formatPrice, getInstrument } from "@/lib/market";
import { TRADERS } from "@/lib/traders";
import { initialsOf } from "@/lib/utils";
import { TickerTape } from "./TickerTape";

/* -------------------------------------------------------------------------- */
/*  Ambient background                                                         */
/* -------------------------------------------------------------------------- */

function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 grid-lines opacity-70" />
      <div
        className="absolute -left-[14%] -top-[22%] h-[62vw] w-[62vw] animate-aurora rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,223,164,0.34), rgba(0,223,164,0) 72%)",
        }}
      />
      <div
        className="absolute -right-[16%] top-[4%] h-[54vw] w-[54vw] animate-aurora rounded-full blur-[120px]"
        style={{
          animationDelay: "-6s",
          background:
            "radial-gradient(closest-side, rgba(99,102,241,0.30), rgba(99,102,241,0) 72%)",
        }}
      />
      <div
        className="absolute bottom-[-26%] left-[26%] h-[48vw] w-[48vw] animate-aurora rounded-full blur-[130px]"
        style={{
          animationDelay: "-12s",
          background:
            "radial-gradient(closest-side, rgba(34,211,238,0.20), rgba(34,211,238,0) 72%)",
        }}
      />
      {/* Vignette keeps the type legible over the brightest part of the glow. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_25%,rgba(4,6,10,0.86)_78%)]" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero visual — a live-feeling account panel                                 */
/* -------------------------------------------------------------------------- */

const CURVE = [
  8, 14, 11, 20, 26, 22, 31, 29, 38, 44, 40, 51, 58, 54, 63, 70, 66, 76, 84, 79, 90, 97,
];

function EquityPanel() {
  const width = 460;
  const height = 150;
  const max = Math.max(...CURVE);
  const points = CURVE.map((v, i) => {
    const x = (i / (CURVE.length - 1)) * width;
    const y = height - (v / max) * (height - 16) - 8;
    return [x, y] as const;
  });

  // Catmull-Rom → cubic Bézier, so the curve is smooth rather than polygonal.
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden="true">
      <defs>
        <linearGradient id="hero-eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00dfa4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00dfa4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#00dfa4" />
          <stop offset="100%" stopColor="#2ff0bd" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={height * f}
          y2={height * f}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      <motion.path
        d={`${d} L${width},${height} L0,${height} Z`}
        fill="url(#hero-eq)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1, delay: 1.05 }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="url(#hero-line)"
        strokeWidth="2.4"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.7, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
      />
      <motion.circle
        cx={points[points.length - 1]![0]}
        cy={points[points.length - 1]![1]}
        r="4.5"
        fill="#2ff0bd"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 2.1, type: "spring", stiffness: 260 }}
      />
    </svg>
  );
}

function HeroVisual() {
  const { quotes } = useMarket();
  const gold = getInstrument("XAUUSD");
  const goldQuote = quotes.XAUUSD;
  const lead = TRADERS[0]!;
  const second = TRADERS[3]!;

  return (
    /* The vertical padding is what the floating cards hang into, so they
       overlap the panel's padding rather than its numbers. */
    <div className="relative mx-auto w-full max-w-lg py-6 sm:py-20 lg:max-w-none lg:py-16">
      {/* Glow behind the stack */}
      <div
        className="absolute inset-x-6 top-10 -z-10 h-72 rounded-full blur-[70px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,223,164,0.30), rgba(0,223,164,0) 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="card-sheen relative rounded-3xl border border-white/[0.09] bg-ink-880/85 p-5 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Copy portfolio value
            </p>
            <p className="mt-1.5 font-display text-[30px] font-bold leading-none text-white">
              $<AnimatedNumber value={48_291.64} decimals={2} duration={2} />
            </p>
          </div>
          <div className="text-right">
            <LiveDot />
            <p className="mt-1.5 tnum text-[13px] font-semibold text-mint-400">+18.42%</p>
            <p className="text-[11px] text-slate-500">30 days</p>
          </div>
        </div>

        <div className="mt-4">
          <EquityPanel />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3.5">
          {[
            { label: "Copied", value: "6 traders" },
            { label: "Open P&L", value: "+$1,284", tone: "text-mint-400" },
            { label: "Win rate", value: "72.4%" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[11px] text-slate-500">{s.label}</p>
              <p className={`mt-0.5 text-[13.5px] font-semibold ${s.tone ?? "text-white"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating trader card */}
      <motion.div
        initial={{ opacity: 0, x: -30, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.75 }}
        className="absolute -bottom-8 -left-3 hidden w-[236px] sm:block sm:-left-8 lg:-left-12"
      >
        <div className="animate-float rounded-2xl border border-white/[0.10] bg-ink-850/95 p-3.5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <div className="flex items-center gap-2.5">
            <Avatar initials={initialsOf(lead.name)} gradient={lead.gradient} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">{lead.name}</p>
              <p className="truncate text-[11px] text-slate-400">{lead.strategy}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-mint-500/10 px-2.5 py-1.5">
            <span className="text-[11px] text-mint-300">Now copying</span>
            <span className="tnum text-[12px] font-semibold text-mint-400">
              +{lead.roi30d}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Floating live-signal card */}
      <motion.div
        initial={{ opacity: 0, x: 30, y: -18 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 1 }}
        className="absolute -right-2 -top-14 hidden w-[206px] sm:block sm:-right-6 lg:-right-10"
      >
        <div
          className="animate-float rounded-2xl border border-white/[0.10] bg-ink-850/95 p-3.5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
          style={{ animationDelay: "-2.5s" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Signal mirrored</span>
            <Sparkles className="h-3.5 w-3.5 text-iris-300" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="rounded bg-mint-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-mint-400">
              BUY
            </span>
            <span className="text-[14px] font-semibold text-white">XAUUSD</span>
          </div>
          <p className="mt-1.5 tnum text-[12px] text-slate-400">
            @ {formatPrice(goldQuote?.price ?? gold.base, gold.digits)}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <Avatar initials={initialsOf(second.name)} gradient={second.gradient} size={18} ring={false} />
            <span className="truncate text-[10.5px] text-slate-500">
              from {second.handle}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

const HEADLINE_WORDS = ["Copy", "the", "traders", "who", "actually", "win."];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-17">
      <Aurora />

      <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-16 sm:px-8 lg:pb-32 lg:pt-24">
        <div className="grid items-center gap-10 sm:gap-16 lg:grid-cols-[1.06fr_1fr] lg:gap-14">
          {/* -- Copy ------------------------------------------------------- */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 backdrop-blur-sm"
            >
              <span className="rounded-full bg-mint-500/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-mint-400">
                New
              </span>
              <span className="text-[13px] text-slate-300">
                Proportional copy engine · 40ms signal latency
              </span>
            </motion.div>

            <h1 className="mt-7 font-display text-[clamp(2.6rem,6.4vw,4.6rem)] font-bold leading-[0.98] text-white">
              {HEADLINE_WORDS.map((word, i) => (
                <motion.span
                  key={word + i}
                  initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.75,
                    delay: 0.12 + i * 0.075,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cnWord(i)}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-slate-400"
            >
              Every strategy provider on AlphaSync is verified, independently audited and
              ranked on results you can inspect trade by trade. Allocate once and their
              positions mirror into your account in real time — with your risk limits, not
              theirs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.72 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <ButtonLink href="/signup" size="lg" className="group">
                Start copying free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </ButtonLink>
              <ButtonLink href="/#platform" variant="secondary" size="lg">
                <PlayCircle className="h-4.5 w-4.5" />
                See the platform
              </ButtonLink>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2.5">
                  {TRADERS.slice(0, 5).map((t) => (
                    <Avatar
                      key={t.id}
                      initials={initialsOf(t.name)}
                      gradient={t.gradient}
                      size={28}
                      className="ring-ink-950"
                    />
                  ))}
                </div>
                <p className="text-[13px] text-slate-400">
                  <span className="font-semibold text-white">184,000+</span> copiers
                </p>
              </div>

              <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <ShieldCheck className="h-4 w-4 text-mint-400" />
                Segregated client funds
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <TrendingUp className="h-4 w-4 text-mint-400" />
                $2.4B copied volume
              </div>
            </motion.div>
          </div>

          {/* -- Visual ----------------------------------------------------- */}
          <div className="relative lg:pl-6">
            <HeroVisual />
          </div>
        </div>
      </div>

      <TickerTape />
    </section>
  );
}

/**
 * The last two words carry the gradient so the headline has a focal point.
 * `inline-block` collapses a trailing space, so the word gap is padding.
 */
function cnWord(i: number) {
  return i >= 4
    ? "text-gradient inline-block pr-[0.26em]"
    : "inline-block pr-[0.26em]";
}
