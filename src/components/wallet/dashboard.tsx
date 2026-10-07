"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { api, fetchChallenge, solveChallenge } from "@/lib/api";
import { clearWallet, type LocalWallet } from "@/lib/wallet-client";
import { formatAmount, shortAddress, cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck,
  Clock,
  Coins,
  Copy,
  Gift,
  LogOut,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unlock,
  Key,
  Loader2,
} from "lucide-react";
import { APP_FULL_NAME, APP_TOKEN_SYMBOL } from "@/lib/config";
import { BrandMark } from "@/components/wallet/brand-mark";
import { CheckInCard } from "@/components/wallet/checkin-card";
import { DepositCard } from "@/components/wallet/deposit-card";
import { StakeCard } from "@/components/wallet/stake-card";

type Tab = "buy" | "stake" | "send" | "activity";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; accent: string }> = [
  { id: "buy", label: "Buy", icon: <Plus className="h-4 w-4" />, accent: "from-amber-500 to-fuchsia-500" },
  { id: "stake", label: "Stake", icon: <TrendingUp className="h-4 w-4" />, accent: "from-emerald-500 to-sky-500" },
  { id: "send", label: "Send", icon: <Send className="h-4 w-4" />, accent: "from-violet-500 to-indigo-500" },
  { id: "activity", label: "Activity", icon: <Clock className="h-4 w-4" />, accent: "from-zinc-400 to-zinc-500" },
];

type TxRecord = {
  id: string;
  type:
    | "send"
    | "receive"
    | "deposit"
    | "checkin"
    | "stake"
    | "unstake"
    | "stake-reward";
  from?: string;
  to?: string;
  amount: number;
  at: number;
  note?: string;
};

type WalletState = {
  address: string;
  balance: number;
  cashback: number;
  staked: number;
  stakeStartedAt: number | null;
  txs: TxRecord[];
  checkinStreak?: number;
  lastCheckinAt?: number | null;
  pendingDeposits?: Array<{
    id: string;
    status: string;
    credited: number;
    currency: string;
    paid: number;
  }>;
};

export function Dashboard({ wallet, onSignOut }: { wallet: LocalWallet; onSignOut: () => void }) {
  const { toast } = useToast();
  const [state, setState] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("buy");

  // Send form
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [hp, setHp] = useState("");
  const [renderedAt] = useState(Date.now());
  const [sending, setSending] = useState(false);

  async function refresh() {
    try {
      const { data } = await api.get<WalletState>("/wallet", {
        params: { address: wallet.address },
      });
      setState(data);
    } catch (e: any) {
      toast({ title: "Could not load wallet", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function updateState(partial: Partial<WalletState>) {
    setState((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const challenge = await fetchChallenge();
      const solution = await solveChallenge(challenge);
      const { data } = await api.post<{ wallet: Partial<WalletState> }>("/send", {
        from: wallet.address,
        to,
        amount: Number(amount),
        note: note || undefined,
        hp,
        renderedAt,
        challenge: { ...challenge, solution },
      });
      updateState(data.wallet);
      toast({
        title: "Sent",
        description: `Sent ${formatAmount(amount)} ${APP_TOKEN_SYMBOL}.`,
        variant: "success" as any,
      });
      setTo("");
      setAmount("");
      setNote("");
    } catch (e: any) {
      toast({ title: "Transaction failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address);
    toast({ title: "Address copied" });
  }

  function copyKey() {
    navigator.clipboard.writeText(wallet.privateKey);
    toast({ title: "Private key copied", description: "Store it somewhere safe.", variant: "success" as any });
  }

  function handleSignOut() {
    clearWallet();
    onSignOut();
  }

  const totalPending = (state?.pendingDeposits ?? [])
    .filter((d) => d.status === "confirming")
    .reduce((s, d) => s + d.credited, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrandMark className="h-9 w-9" />
          <div className="font-semibold tracking-tight">{APP_FULL_NAME}</div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Key className="mr-2 h-4 w-4" /> Backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Back up your wallet</DialogTitle>
                <DialogDescription>
                  Store your private key offline. Anyone with this key controls your funds.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
                  {showKey ? wallet.privateKey : "•".repeat(66)}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowKey((s) => !s)} className="flex-1">
                    {showKey ? "Hide" : "Reveal"}
                  </Button>
                  <Button onClick={copyKey} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/10 bg-zinc-950/95 backdrop-blur-xl sm:max-w-md">
              <DialogHeader>
                <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-white">Sign out of this wallet?</DialogTitle>
                <DialogDescription className="text-zinc-300">
                  Your private key will be removed from this device. You&apos;ll need your{" "}
                  <span className="font-medium text-white">recovery phrase</span> or{" "}
                  <span className="font-medium text-white">private key</span> to sign back in.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-100">
                <div className="flex items-start gap-2.5">
                  <Key className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>
                    Haven&apos;t backed up yet? Close this and tap{" "}
                    <span className="font-semibold text-amber-200">Backup</span> first — once
                    you&apos;re signed out, there&apos;s no way to recover without your phrase or key.
                  </span>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <DialogClose asChild>
                  <Button variant="secondary" className="sm:min-w-28">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleSignOut}
                  className="sm:min-w-28"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Balance card */}
      <Card className="card-shine border-0 text-white">
        <CardContent className="relative z-10 flex flex-col gap-5 p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/70">Available balance</div>
              <div className="mt-2 text-4xl font-semibold md:text-5xl">
                {loading ? "…" : formatAmount(state?.balance ?? 0, 4)}{" "}
                <span className="text-base font-normal text-white/70">{APP_TOKEN_SYMBOL}</span>
              </div>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
              <Gift className="mr-1 inline h-3.5 w-3.5" />
              {formatAmount(state?.cashback ?? 0, 4)} earned
            </div>
          </div>
          {totalPending > 0 && (
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200 ring-1 ring-amber-400/30">
              <Loader2 className="h-3 w-3 animate-spin" />
              +{formatAmount(totalPending, 4)} {APP_TOKEN_SYMBOL} pending
            </div>
          )}
          <button
            onClick={copyAddress}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-xs backdrop-blur hover:bg-black/40"
          >
            <span className="font-mono">{shortAddress(wallet.address, 6)}</span>
            <Copy className="h-3.5 w-3.5" />
          </button>

          <CheckInCard
            address={wallet.address}
            walletState={state}
            onWalletUpdate={updateState}
          />
        </CardContent>
      </Card>

      {/* Tab bar */}
      <div className="relative mt-5 flex gap-1.5 rounded-2xl bg-white/[0.04] p-1.5 ring-1 ring-white/[0.08]">
        <div
          className={cn(
            "absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            TABS.find((t) => t.id === activeTab)!.accent
          )}
          style={{
            width: `calc((100% - ${(TABS.length - 1) * 6}px - 12px) / ${TABS.length})`,
            left: `calc(${TABS.findIndex((t) => t.id === activeTab)} * ((100% - ${(TABS.length - 1) * 6}px - 12px) / ${TABS.length} + 6px) + 6px)`,
          }}
        />
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active section – keep tabs mounted to avoid re-fetching */}
      <div className="mt-5">
        <div className={activeTab === "buy" ? "tab-enter" : "hidden"}>
          <DepositCard address={wallet.address} onWalletUpdate={updateState} />
        </div>

        <div className={activeTab === "stake" ? "tab-enter" : "hidden"}>
          <StakeCard address={wallet.address} walletState={state} onWalletUpdate={updateState} />
        </div>

        <div className={activeTab === "send" ? "tab-enter" : "hidden"}>
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-sky-500/10">
            <CardContent className="relative p-5 md:p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-16 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />

              <div className="relative flex items-start gap-3 mb-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Send {APP_TOKEN_SYMBOL}</div>
                  <p className="mt-0.5 text-xs text-zinc-300">Transfer to any address instantly.</p>
                </div>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="relative grid gap-4">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="hidden"
                  aria-hidden="true"
                />
                <div className="grid gap-2">
                  <Label htmlFor="to" className="text-xs text-zinc-300">Recipient address</Label>
                  <Input
                    id="to"
                    placeholder="0x…"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    spellCheck={false}
                    className="h-12 rounded-xl border-white/15 bg-black/40 px-4 font-mono text-sm text-white placeholder:text-zinc-500 focus-visible:border-violet-400/60 focus-visible:ring-violet-400/30"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-xs text-zinc-300">Amount ({APP_TOKEN_SYMBOL})</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.0001"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="h-12 rounded-xl border-white/15 bg-black/40 px-4 font-mono text-sm text-white placeholder:text-zinc-500 focus-visible:border-violet-400/60 focus-visible:ring-violet-400/30"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="note" className="text-xs text-zinc-300">Note (optional)</Label>
                    <Input
                      id="note"
                      maxLength={140}
                      placeholder="Dinner split"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="h-12 rounded-xl border-white/15 bg-black/40 px-4 text-sm text-white placeholder:text-zinc-500 focus-visible:border-violet-400/60 focus-visible:ring-violet-400/30"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  disabled
                  className="group relative h-12 w-full overflow-hidden rounded-xl text-base font-medium text-white bg-white/10 text-zinc-400 cursor-not-allowed"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending&hellip;
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        {amount ? `Send ${amount} ${APP_TOKEN_SYMBOL}` : "Send"}
                      </>
                    )}
                  </span>
                  {to && amount && !sending && (
                    <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] transition-transform duration-700 group-hover:translate-x-[100%]" />
                  )}
                </Button>
                <p className="flex items-center justify-center gap-2 text-[11px] text-zinc-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Protected by rate limiting &amp; proof-of-work bot check
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className={activeTab === "activity" ? "tab-enter" : "hidden"}>
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-zinc-500/5 via-zinc-500/5 to-zinc-500/5">
            <CardContent className="relative p-5 md:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-700 text-white shadow-lg shadow-zinc-500/20">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Activity</div>
                  <p className="mt-0.5 text-xs text-zinc-300">Recent transactions on this wallet.</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : !state || state.txs.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  No transactions yet.
                </div>
              ) : (
                <ul className="space-y-1">
                  {state.txs.map((tx) => (
                    <TxRow key={tx.id} tx={tx} me={wallet.address} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TxRow({ tx, me }: { tx: TxRecord; me: string }) {
  const isOutgoing = tx.type === "send" || tx.type === "stake";
  const other =
    tx.type === "send"
      ? tx.to
      : tx.type === "receive"
      ? tx.from
      : undefined;
  const sign = isOutgoing ? "-" : "+";

  const icon =
    tx.type === "send" ? (
      <ArrowUpRight className="h-4 w-4 text-rose-400" />
    ) : tx.type === "receive" ? (
      <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
    ) : tx.type === "checkin" ? (
      <CalendarCheck className="h-4 w-4 text-fuchsia-300" />
    ) : tx.type === "stake" ? (
      <Lock className="h-4 w-4 text-sky-300" />
    ) : tx.type === "unstake" ? (
      <Unlock className="h-4 w-4 text-sky-300" />
    ) : tx.type === "stake-reward" ? (
      <Coins className="h-4 w-4 text-emerald-300" />
    ) : (
      <Sparkles className="h-4 w-4 text-amber-400" />
    );

  const label =
    tx.type === "send"
      ? "Sent"
      : tx.type === "receive"
      ? "Received"
      : tx.type === "checkin"
      ? "Daily check-in"
      : tx.type === "stake"
      ? "Staked"
      : tx.type === "unstake"
      ? "Unstaked"
      : tx.type === "stake-reward"
      ? "Staking reward"
      : "Welcome bonus";

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-[11px] text-zinc-500">
            {other ? shortAddress(other, 4) : "—"} · {new Date(tx.at).toLocaleString()}
          </div>
          {tx.note && <div className="mt-0.5 text-[11px] text-zinc-400">&ldquo;{tx.note}&rdquo;</div>}
        </div>
      </div>
      <div className={cn(
        "text-sm font-semibold tabular-nums",
        isOutgoing ? "text-rose-400" : "text-emerald-400"
      )}>
        {sign}{formatAmount(tx.amount, 4)}
      </div>
    </li>
  );
}
