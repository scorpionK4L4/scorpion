"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { formatAmount, cn } from "@/lib/utils";
import { APP_TOKEN_SYMBOL } from "@/lib/config";
import { Clock, Coins, Lock, TrendingUp, Unlock } from "lucide-react";

type Mode = "stake" | "unstake";

const DAY_MS = 24 * 60 * 60 * 1000;
const APR = 0.02;
const DAILY_RATE = APR / 365;

type WalletState = {
  balance: number;
  staked: number;
  stakeStartedAt: number | null;
  [key: string]: unknown;
};

export function StakeCard({
  address,
  walletState,
  onWalletUpdate,
}: {
  address: string;
  walletState: WalletState | null;
  onWalletUpdate?: (partial: Partial<WalletState>) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const staked = walletState?.staked ?? 0;
  const balance = walletState?.balance ?? 0;
  const stakeStartedAt = walletState?.stakeStartedAt ?? null;

  const needsTick = staked > 0;
  useEffect(() => {
    if (!needsTick) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [needsTick]);

  const pending = useMemo(() => {
    if (!stakeStartedAt || staked <= 0) return 0;
    const days = Math.floor((Date.now() - stakeStartedAt) / DAY_MS);
    if (days <= 0) return 0;
    return round(staked * DAILY_RATE * days, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staked, stakeStartedAt, tick]);

  const dailyReward = staked > 0 ? round(staked * DAILY_RATE, 6) : 0;

  const remainingMs = useMemo(() => {
    if (!stakeStartedAt || staked <= 0) return 0;
    const daysElapsed = Math.floor((Date.now() - stakeStartedAt) / DAY_MS);
    const nextAt = stakeStartedAt + (daysElapsed + 1) * DAY_MS;
    return Math.max(0, nextAt - Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staked, stakeStartedAt, tick]);

  const dayProgress = staked > 0
    ? Math.min(1, Math.max(0, 1 - remainingMs / DAY_MS))
    : 0;

  async function act(action: "stake" | "unstake" | "claim") {
    if (busy) return;
    const body: any = { address, action };
    if (action !== "claim") {
      const n = Number(amount);
      if (!(n > 0) || !isFinite(n)) {
        toast({ title: "Enter an amount", variant: "destructive" });
        return;
      }
      body.amount = n;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ reward?: number; wallet?: Partial<WalletState> }>("/stake", body);
      if (action === "stake") {
        toast({
          title: "Staked",
          description: `Earning ${APR * 100}% APR on ${formatAmount(body.amount)} ${APP_TOKEN_SYMBOL}.`,
          variant: "success" as any,
        });
      } else if (action === "unstake") {
        toast({
          title: "Unstaked",
          description: `${formatAmount(body.amount)} ${APP_TOKEN_SYMBOL} returned to balance.`,
          variant: "success" as any,
        });
      } else {
        toast({
          title: `Claimed +${formatAmount(data.reward ?? 0, 6)} ${APP_TOKEN_SYMBOL}`,
          description: "Rewards added to your balance.",
          variant: "success" as any,
        });
      }
      setAmount("");
      if (data.wallet) {
        onWalletUpdate?.(data.wallet);
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const aprPct = (APR * 100).toFixed(0);
  const maxForMode = mode === "stake" ? balance : staked;

  function setPercent(p: number) {
    const v = Math.max(0, maxForMode * p);
    setAmount(v > 0 ? String(round(v, 4)) : "");
  }

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-violet-500/10">
      <CardContent className="relative p-5 md:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-16 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/30">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                Stake &amp; earn
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-400/30">
                  <TrendingUp className="h-3 w-3" /> {aprPct}% APR
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-300">
                Lock {APP_TOKEN_SYMBOL} to earn rewards every second.
              </p>
            </div>
          </div>
        </div>

        {/* Stake stats */}
        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Staked
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-white">
              {formatAmount(staked, 4)}{" "}
              <span className="text-xs font-normal text-zinc-400">{APP_TOKEN_SYMBOL}</span>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-emerald-300">
              <span>Pending reward</span>
              {staked > 0 && (
                <span className="text-emerald-300/70">
                  +{formatAmount(dailyReward, 6)}/day
                </span>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-200">
              {formatAmount(pending, 6)}{" "}
              <span className="text-xs font-normal text-emerald-300/80">{APP_TOKEN_SYMBOL}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Available
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-white">
              {formatAmount(balance, 4)}{" "}
              <span className="text-xs font-normal text-zinc-400">{APP_TOKEN_SYMBOL}</span>
            </div>
          </div>
        </div>

        {/* Next-reward countdown + progress bar */}
        {staked > 0 && (
          <div className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-zinc-300">
                <Clock className="h-3.5 w-3.5 text-emerald-300" />
                Next <span className="font-semibold text-white">+{formatAmount(dailyReward, 6)}</span> in
              </span>
              <span className="font-mono text-sm font-semibold text-white tabular-nums">
                {formatCountdown(remainingMs)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-[width] duration-700 ease-out"
                style={{ width: `${(dayProgress * 100).toFixed(2)}%` }}
              />
            </div>
          </div>
        )}

        {/* Stake / unstake switcher */}
        <div className="relative mt-5 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
          <SegBtn
            active={mode === "stake"}
            onClick={() => {
              setMode("stake");
              setAmount("");
            }}
            icon={<Lock className="h-4 w-4" />}
            label="Stake"
          />
          <SegBtn
            active={mode === "unstake"}
            onClick={() => {
              setMode("unstake");
              setAmount("");
            }}
            icon={<Unlock className="h-4 w-4" />}
            label="Unstake"
          />
        </div>

        {/* Amount field + quick-% chips */}
        <div className="relative mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-zinc-300">
              Amount{" "}
              <span className="text-zinc-500">
                · max {formatAmount(maxForMode, 4)} {APP_TOKEN_SYMBOL}
              </span>
            </span>
            <div className="flex items-center gap-1">
              {[0.25, 0.5, 1].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPercent(p)}
                  disabled={maxForMode <= 0}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  {p === 1 ? "MAX" : `${p * 100}%`}
                </button>
              ))}
            </div>
          </div>
          <Input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.0001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 rounded-xl border-white/15 bg-black/40 px-4 font-mono text-base tracking-wider text-white placeholder:text-zinc-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/30"
          />
        </div>

        {/* Actions */}
        <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            onClick={() => act(mode)}
            disabled={busy || !amount || Number(amount) <= 0}
            className={cn(
              "h-11 rounded-xl text-sm font-medium",
              mode === "stake"
                ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] hover:brightness-110"
                : "bg-white/10 text-white hover:bg-white/15"
            )}
          >
            {mode === "stake" ? (
              <>
                <Lock className="mr-1.5 h-4 w-4" /> Stake
              </>
            ) : (
              <>
                <Unlock className="mr-1.5 h-4 w-4" /> Unstake
              </>
            )}
          </Button>
          <Button
            onClick={() => act("claim")}
            disabled={busy || pending <= 0}
            variant="secondary"
            className="h-11 rounded-xl text-sm font-medium"
          >
            Claim rewards
          </Button>
        </div>

        <p className="relative mt-3 text-center text-[11px] text-zinc-400">
          Rewards bump once every 24h at {aprPct}% APR; the sub-day remainder carries over.
        </p>
      </CardContent>
    </Card>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-gradient-to-br from-white/20 to-white/10 text-white shadow-sm ring-1 ring-white/15"
          : "text-zinc-400 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function round(n: number, d = 4) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
