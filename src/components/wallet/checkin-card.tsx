"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { APP_TOKEN_SYMBOL } from "@/lib/config";
import { CalendarCheck, Flame, Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Celebration = {
  id: number;
  reward: number;
  pieces: Array<{
    dx: number;
    dy: number;
    rot: number;
    color: string;
    delay: number;
    size: number;
  }>;
};

const CONFETTI_COLORS = [
  "#f472b6",
  "#a78bfa",
  "#38bdf8",
  "#fbbf24",
  "#34d399",
  "#e879f9",
];

function buildConfetti(count = 26): Celebration["pieces"] {
  const pieces: Celebration["pieces"] = [];
  for (let i = 0; i < count; i++) {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.3;
    const distance = 90 + Math.random() * 110;
    pieces.push({
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rot: (Math.random() - 0.5) * 1440,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 80,
      size: 6 + Math.random() * 8,
    });
  }
  return pieces;
}

type Status = {
  canClaim: boolean;
  streak: number;
  nextStreak: number;
  nextReward: number;
  lastCheckinAt: number | null;
  nextEligibleAt: number;
};

const REWARDS = [5, 8, 12, 18, 25, 35, 60] as const;

type WalletState = {
  balance: number;
  checkinStreak?: number;
  lastCheckinAt?: number | null;
  [key: string]: unknown;
};

export function CheckInCard({
  address,
  walletState,
  onWalletUpdate,
}: {
  address: string;
  walletState: WalletState | null;
  onWalletUpdate?: (partial: Partial<WalletState>) => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [buttonPop, setButtonPop] = useState(false);
  const [streakWiggle, setStreakWiggle] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebrationTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Status>("/checkin", { params: { address } });
      setStatus(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  const needsTick = !!status && !status.canClaim;
  useEffect(() => {
    if (!needsTick) return;
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [needsTick]);

  useEffect(() => {
    return () => {
      celebrationTimers.current.forEach(clearTimeout);
      celebrationTimers.current = [];
    };
  }, []);

  const fireCelebration = useCallback((reward: number) => {
    celebrationTimers.current.forEach(clearTimeout);
    celebrationTimers.current = [];

    setCelebration({ id: Date.now(), reward, pieces: buildConfetti() });
    setButtonPop(true);
    setStreakWiggle(true);

    celebrationTimers.current.push(
      setTimeout(() => setButtonPop(false), 650),
      setTimeout(() => setStreakWiggle(false), 750),
      setTimeout(() => setCelebration(null), 1800)
    );
  }, []);

  useEffect(() => {
    if (!status || status.canClaim) return;
    if (now >= status.nextEligibleAt) load();
  }, [now, status, load]);

  async function handleClaim() {
    if (!status?.canClaim || claiming) return;
    setClaiming(true);
    try {
      const { data } = await api.post<{ reward: number; streak: number; wallet?: Partial<WalletState> }>("/checkin", { address });
      fireCelebration(data.reward);
      toast({
        title: `+${formatAmount(data.reward)} ${APP_TOKEN_SYMBOL}`,
        description: `Day ${data.streak} claimed — see you tomorrow for day ${data.streak + 1}.`,
        variant: "success" as any,
      });
      setStatus({
        canClaim: false,
        streak: data.streak,
        nextStreak: data.streak + 1,
        nextReward: REWARDS[data.streak % REWARDS.length],
        lastCheckinAt: Date.now(),
        nextEligibleAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      if (data.wallet) onWalletUpdate?.(data.wallet);
    } catch (e: any) {
      toast({ title: "Could not claim", description: e.message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  }

  const streak = status?.streak ?? 0;
  const nextStreak = status?.nextStreak ?? 1;
  const nextReward = status?.nextReward ?? REWARDS[0];
  const canClaim = !!status?.canClaim;
  const positionInWeek = ((nextStreak - 1) % 7);
  const completedInWeek = canClaim
    ? ((streak - 1) % 7 + 1) % 7
    : (streak - 1) % 7 + 1;

  const remainingMs = Math.max(0, (status?.nextEligibleAt ?? now) - now);

  return (
    <div className="relative">
      <div className="mb-3 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
            <CalendarCheck className="h-4 w-4 text-fuchsia-300" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
              Daily check-in
              {streak > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-400/25">
                  <Flame className={cn("h-2.5 w-2.5", streakWiggle && "streak-wiggle")} />
                  {streak}d
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/50">
              {canClaim ? (
                <span className="text-fuchsia-200/80">
                  +{formatAmount(nextReward)} {APP_TOKEN_SYMBOL} ready!
                </span>
              ) : (
                <span>
                  Next in <span className="font-mono">{formatCountdown(remainingMs)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          {celebration && (
            <>
              <span key={`burst-${celebration.id}`} className="claim-burst" aria-hidden />
              <div
                key={`confetti-${celebration.id}`}
                className="pointer-events-none absolute inset-0 overflow-visible"
                aria-hidden
              >
                {celebration.pieces.map((p, i) => (
                  <span
                    key={i}
                    className="confetti-piece"
                    style={{
                      backgroundColor: p.color,
                      width: `${p.size}px`,
                      height: `${p.size * 1.4}px`,
                      animationDelay: `${p.delay}ms`,
                      ["--dx" as any]: `${p.dx}px`,
                      ["--dy" as any]: `${p.dy}px`,
                      ["--rot" as any]: `${p.rot}deg`,
                    }}
                  />
                ))}
              </div>
              <div
                key={`reward-${celebration.id}`}
                className="reward-float z-20"
                aria-live="polite"
              >
                <div className="whitespace-nowrap rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 px-3 py-1 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/40 ring-2 ring-white/40">
                  +{formatAmount(celebration.reward)} {APP_TOKEN_SYMBOL}
                </div>
              </div>
            </>
          )}

          <Button
            onClick={handleClaim}
            disabled={!canClaim || claiming || loading}
            size="sm"
            className={cn(
              "relative overflow-hidden rounded-lg text-xs font-semibold",
              canClaim
                ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white shadow-[0_6px_20px_-6px_rgba(217,70,239,0.5)] hover:brightness-110"
                : "bg-white/10 text-white/40",
              buttonPop && "claim-pop"
            )}
          >
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {claiming ? (
                "Claiming…"
              ) : canClaim ? (
                <>
                  <Gift className="h-3.5 w-3.5" />
                  Claim +{formatAmount(nextReward)}
                </>
              ) : (
                <>{formatCountdown(remainingMs)}</>
              )}
            </span>
            {canClaim && (
              <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] transition-transform duration-700 group-hover:translate-x-[100%]" />
            )}
          </Button>
        </div>
      </div>

      {/* 7-day reward row */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {REWARDS.map((amt, i) => {
          const isNext = canClaim && i === positionInWeek;
          const isDone =
            (canClaim && i < positionInWeek) ||
            (!canClaim && i < completedInWeek);
          const isBigDay = i === REWARDS.length - 1;
          return (
            <div
              key={i}
              className={cn(
                "relative flex flex-col items-center rounded-lg border py-1.5 text-center transition-all",
                isDone
                  ? "border-emerald-400/25 bg-emerald-500/10"
                  : isNext
                  ? "border-fuchsia-400/40 bg-fuchsia-500/15 shadow-md shadow-fuchsia-500/15"
                  : "border-white/5 bg-white/5",
                isBigDay && !isDone && "ring-1 ring-amber-400/15"
              )}
            >
              <span
                className={cn(
                  "text-[9px] font-medium uppercase tracking-wider",
                  isDone
                    ? "text-emerald-300/80"
                    : isNext
                    ? "text-fuchsia-200/80"
                    : "text-white/25"
                )}
              >
                D{i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums leading-tight",
                  isDone
                    ? "text-emerald-200/90"
                    : isNext
                    ? "text-white"
                    : isBigDay
                    ? "text-amber-200/70"
                    : "text-white/40"
                )}
              >
                {amt}
              </span>
              {isBigDay && !isDone && (
                <Sparkles
                  className={cn(
                    "absolute -right-0.5 -top-0.5 h-2.5 w-2.5",
                    isNext ? "text-fuchsia-200" : "text-amber-300/60"
                  )}
                />
              )}
              {isDone && (
                <span className="absolute -right-0.5 -top-0.5 grid h-3 w-3 place-items-center rounded-full bg-emerald-400 text-[7px] font-bold text-emerald-950">
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
