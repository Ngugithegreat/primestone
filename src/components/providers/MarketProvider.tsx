"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { INSTRUMENTS, nextTick, type Instrument } from "@/lib/market";

export type Quote = {
  price: number;
  prev: number;
  /** Percent change against the instrument's session open. */
  changePct: number;
  dir: 1 | -1 | 0;
};

type MarketContextValue = {
  quotes: Record<string, Quote>;
  prices: Record<string, number>;
  live: boolean;
};

const seedQuotes = (): Record<string, Quote> =>
  Object.fromEntries(
    INSTRUMENTS.map((i) => [
      i.id,
      { price: i.base, prev: i.base, changePct: i.drift, dir: 0 as const },
    ]),
  );

const MarketContext = createContext<MarketContextValue>({
  quotes: seedQuotes(),
  prices: Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.base])),
  live: false,
});

const TICK_MS = 1100;

/**
 * Drives every price on the site from one interval. Ticking starts only after
 * mount, so the server-rendered quote (the instrument's base price) is what
 * the client renders on its first pass too.
 */
export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>(seedQuotes);
  const [live, setLive] = useState(false);
  const opens = useRef<Record<string, number>>(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.base / (1 + i.drift / 100)])),
  );

  useEffect(() => {
    setLive(true);
    const byId: Record<string, Instrument> = Object.fromEntries(
      INSTRUMENTS.map((i) => [i.id, i]),
    );

    const id = window.setInterval(() => {
      setQuotes((current) => {
        const next: Record<string, Quote> = {};
        for (const key of Object.keys(current)) {
          const inst = byId[key]!;
          const prev = current[key]!.price;
          // Only a subset of the board moves on any given tick, which reads far
          // more like a real feed than every row flickering in lockstep.
          const price = Math.random() < 0.55 ? nextTick(prev, inst) : prev;
          const open = opens.current[key] ?? inst.base;
          next[key] = {
            price,
            prev,
            changePct: ((price - open) / open) * 100,
            dir: price > prev ? 1 : price < prev ? -1 : 0,
          };
        }
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<MarketContextValue>(
    () => ({
      quotes,
      prices: Object.fromEntries(Object.entries(quotes).map(([k, v]) => [k, v.price])),
      live,
    }),
    [quotes, live],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  return useContext(MarketContext);
}

export function useQuote(symbol: string): Quote {
  const { quotes } = useMarket();
  return quotes[symbol] ?? { price: 0, prev: 0, changePct: 0, dir: 0 };
}
