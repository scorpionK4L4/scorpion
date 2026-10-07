"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { formatAmount, cn } from "@/lib/utils";
import {
  APP_NAME,
  APP_TOKEN_SYMBOL,
  DEPOSIT_RATE_USDT,
  DEPOSIT_RATE_BTC,
  DEPOSIT_RATE_SOL,
} from "@/lib/config";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Loader2,
  Plus,
  ShieldAlert,
  Wallet,
} from "lucide-react";

type Currency = "USDT" | "BTC" | "SOL";

type PendingDeposit = {
  id: string;
  currency: Currency;
  paid: number;
  credited: number;
  depositAddress: string;
  status: "awaiting_payment" | "confirming" | "confirmed";
  createdAt: number;
  sentAt: number | null;
  confirmedAt: number | null;
};

const CURRENCIES: Array<{
  code: Currency;
  label: string;
  accent: string;
  ring: string;
  quick: number[];
  placeholder: string;
}> = [
  {
    code: "USDT",
    label: "Tether",
    accent: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-400/40",
    quick: [10, 50, 100, 500],
    placeholder: "100.00",
  },
  {
    code: "BTC",
    label: "Bitcoin",
    accent: "from-amber-500 to-orange-500",
    ring: "ring-amber-400/40",
    quick: [0.001, 0.01, 0.1, 1],
    placeholder: "0.01",
  },
  {
    code: "SOL",
    label: "Solana",
    accent: "from-fuchsia-500 to-violet-500",
    ring: "ring-fuchsia-400/40",
    quick: [1, 5, 25, 100],
    placeholder: "5.00",
  },
];

const FALLBACK_RATES: Record<Currency, number> = {
  USDT: DEPOSIT_RATE_USDT,
  BTC: DEPOSIT_RATE_BTC,
  SOL: DEPOSIT_RATE_SOL,
};

export function DepositCard({
  address,
  onWalletUpdate,
}: {
  address: string;
  onWalletUpdate?: (partial: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const [currency, setCurrency] = useState<Currency>("USDT");
  const [amount, setAmount] = useState("");
  const [rates, setRates] = useState<Record<Currency, number> | null>(null);
  const [busy, setBusy] = useState(false);

  const [activeDeposit, setActiveDeposit] = useState<PendingDeposit | null>(
    null
  );
  const [modalStep, setModalStep] = useState<"send" | "sent">("send");
  const [markingAsSent, setMarkingAsSent] = useState(false);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);

  useEffect(() => {
    api
      .get<{
        rates: Record<Currency, number>;
        pendingDeposits?: PendingDeposit[];
      }>("/deposit", { params: { address } })
      .then(({ data }) => {
        if (data.rates) setRates(data.rates);
        setPendingDeposits(data.pendingDeposits ?? []);
      })
      .catch(() => {});
  }, [address]);

  const activeCurrency = CURRENCIES.find((c) => c.code === currency)!;
  const rate = rates?.[currency] ?? FALLBACK_RATES[currency];
  const numericAmount = Number(amount);
  const willReceive = useMemo(() => {
    if (!(numericAmount > 0) || !isFinite(numericAmount)) return 0;
    return numericAmount * rate;
  }, [numericAmount, rate]);

  async function handleDeposit() {
    if (!(numericAmount > 0)) {
      toast({ title: "Enter an amount first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post<{ deposit: PendingDeposit }>("/deposit", {
        address,
        currency,
        amount: numericAmount,
      });
      const deposit = data.deposit;
      setActiveDeposit(deposit);
      setModalStep("send");
      setAmount("");
      setPendingDeposits((prev) => [...prev, deposit]);
    } catch (e: any) {
      toast({
        title: "Deposit failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSent() {
    if (!activeDeposit || markingAsSent) return;
    setMarkingAsSent(true);
    try {
      const { data } = await api.post<{ deposit: PendingDeposit }>("/deposit", {
        action: "confirm-sent",
        address,
        depositId: activeDeposit.id,
      });
      const updated = data.deposit;
      setPendingDeposits((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      setActiveDeposit(updated);
      setModalStep("sent");
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setMarkingAsSent(false);
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  }

  function closeModal() {
    setActiveDeposit(null);
    setModalStep("send");
  }

  const visiblePending = pendingDeposits.filter(
    (d) => d.status === "confirming" || d.status === "confirmed"
  );

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-amber-500/10 via-fuchsia-500/5 to-sky-500/10">
      <CardContent className="relative p-5 md:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-16 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-fuchsia-500 text-white shadow-lg shadow-amber-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                Buy {APP_TOKEN_SYMBOL}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-200 ring-1 ring-white/15">
                  Instant
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-300">
                Pay with crypto to top up your {APP_NAME} balance.
              </p>
            </div>
          </div>
        </div>

        {visiblePending.length > 0 && (
          <div className="relative mt-4 space-y-2">
            {visiblePending.map((dep) => (
              <div
                key={dep.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3.5 py-2.5",
                  dep.status === "confirming"
                    ? "border-amber-400/20 bg-amber-500/10"
                    : "border-emerald-400/20 bg-emerald-500/10"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {dep.status === "confirming" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                  ) : (
                    <Check className="h-4 w-4 text-emerald-300" />
                  )}
                  <div>
                    <div className="text-xs font-medium text-white">
                      {dep.paid} {dep.currency} &rarr;{" "}
                      {formatAmount(dep.credited, 2)} {APP_TOKEN_SYMBOL}
                    </div>
                    <div
                      className={cn(
                        "text-[10px]",
                        dep.status === "confirming"
                          ? "text-amber-200/70"
                          : "text-emerald-200/70"
                      )}
                    >
                      {dep.status === "confirming"
                        ? "Confirming on network…"
                        : "Confirmed!"}
                    </div>
                  </div>
                </div>
                {dep.status === "confirming" && (
                  <Clock className="h-3.5 w-3.5 text-amber-300/50" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          {CURRENCIES.map((c) => {
            const isActive = currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c.code);
                  setAmount("");
                }}
                className={cn(
                  "group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all",
                  isActive
                    ? "border-white/20 bg-white/10 shadow-sm"
                    : "border-white/5 bg-white/5 hover:bg-white/10"
                )}
              >
                <TokenBadge
                  code={c.code}
                  accent={c.accent}
                  ring={isActive ? c.ring : ""}
                />
                <div className="min-w-0 leading-tight">
                  <div
                    className={cn(
                      "truncate text-sm font-semibold",
                      isActive ? "text-white" : "text-zinc-200"
                    )}
                  >
                    {c.code}
                  </div>
                  <div className="truncate text-[10px] text-zinc-400">
                    {c.label}
                  </div>
                </div>
                {isActive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative mt-5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-zinc-300">You pay</span>
            <div className="flex items-center gap-1">
              {activeCurrency.quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              placeholder={activeCurrency.placeholder}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 rounded-xl border-white/15 bg-black/40 pl-4 pr-24 font-mono text-lg tracking-wider text-white placeholder:text-zinc-500 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/30"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2">
              <TokenBadge
                code={currency}
                accent={activeCurrency.accent}
                small
              />
              <span className="text-sm font-semibold text-zinc-200">
                {currency}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-3 flex items-center justify-center">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-zinc-300 ring-1 ring-white/10">
            <ArrowRight className="h-3.5 w-3.5 rotate-90" />
          </div>
        </div>

        <div className="relative mt-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-zinc-300">You receive</span>
            <span className="text-zinc-500">
              Rate: 1 {currency} &asymp; {formatAmount(rate)} {APP_TOKEN_SYMBOL}
            </span>
          </div>
          <div className="relative">
            <div
              className={cn(
                "flex h-14 items-center rounded-xl border px-4 font-mono text-lg tracking-wider",
                willReceive > 0
                  ? "border-fuchsia-400/40 bg-fuchsia-500/5 text-white"
                  : "border-white/10 bg-black/30 text-zinc-500"
              )}
            >
              {formatAmount(willReceive, 4)}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-sky-500 text-[9px] font-bold text-white ring-1 ring-white/20">
                <Wallet className="h-3 w-3" />
              </div>
              <span className="text-sm font-semibold text-zinc-200">
                {APP_TOKEN_SYMBOL}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleDeposit}
          disabled={busy || !(numericAmount > 0)}
          className={cn(
            "group relative mt-5 h-12 w-full overflow-hidden rounded-xl text-base font-medium text-white",
            numericAmount > 0
              ? "bg-gradient-to-r from-amber-500 via-fuchsia-500 to-sky-500 shadow-[0_10px_40px_-10px_rgba(217,70,239,0.5)] hover:brightness-110"
              : "bg-white/10 text-zinc-400"
          )}
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing&hellip;
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Deposit{" "}
                {numericAmount > 0 ? `${numericAmount} ${currency}` : currency}
              </>
            )}
          </span>
          {numericAmount > 0 && !busy && (
            <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] transition-transform duration-700 group-hover:translate-x-[100%]" />
          )}
        </Button>


        <Dialog
          open={!!activeDeposit}
          onOpenChange={(open) => {
            if (!open) closeModal();
          }}
        >
          <DialogContent className="border-white/10 bg-zinc-950/95 backdrop-blur-xl sm:max-w-md">
            {activeDeposit && modalStep === "send" && (
              <>
                <DialogHeader>
                  <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <DialogTitle className="text-white">
                    Send exactly {activeDeposit.paid} {activeDeposit.currency}
                  </DialogTitle>
                  <DialogDescription className="text-zinc-300">
                    Transfer the exact amount to the address below. You will
                    receive{" "}
                    <span className="font-semibold text-white">
                      {formatAmount(activeDeposit.credited, 4)}{" "}
                      {APP_TOKEN_SYMBOL}
                    </span>{" "}
                    once confirmed.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    {activeDeposit.currency} deposit address
                  </div>
                  <div className="group relative rounded-xl border border-white/10 bg-black/40 p-3">
                    <div className="break-all pr-10 font-mono text-[13px] leading-relaxed text-white">
                      {activeDeposit.depositAddress}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(activeDeposit!.depositAddress, "Address")
                      }
                      className="absolute right-2 top-2.5 rounded-lg bg-white/10 p-1.5 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      Amount to send
                    </div>
                    <div className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                      {activeDeposit.paid} {activeDeposit.currency}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(String(activeDeposit!.paid), "Amount")
                    }
                    className="rounded-lg bg-white/10 p-2 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-100">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>
                      Make sure you have sent the{" "}
                      <span className="font-semibold text-amber-200">
                        exact amount
                      </span>{" "}
                      to the{" "}
                      <span className="font-semibold text-amber-200">
                        correct address
                      </span>{" "}
                      before confirming. This action cannot be reversed.
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleConfirmSent}
                  disabled={markingAsSent}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-500 text-base font-medium text-white shadow-lg hover:brightness-110"
                >
                  {markingAsSent ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Confirming&hellip;
                    </>
                  ) : (
                    "I have sent it"
                  )}
                </Button>
              </>
            )}

            {activeDeposit && modalStep === "sent" && (
              <>
                <DialogHeader>
                  <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
                    <Clock className="h-5 w-5" />
                  </div>
                  <DialogTitle className="text-white">
                    Payment received
                  </DialogTitle>
                  <DialogDescription className="text-zinc-300">
                    Your deposit of{" "}
                    <span className="font-semibold text-white">
                      {formatAmount(activeDeposit.credited, 4)}{" "}
                      {APP_TOKEN_SYMBOL}
                    </span>{" "}
                    is now being confirmed on the network.
                  </DialogDescription>
                </DialogHeader>

                <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-sky-100">
                  <div className="flex items-start gap-2.5">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-300" />
                    <span>
                      This usually takes{" "}
                      <span className="font-semibold text-sky-200">
                        1&ndash;2 minutes
                      </span>
                      . You can close this dialog &mdash; your deposit will
                      appear as pending on the dashboard and will be credited
                      automatically once confirmed.
                    </span>
                  </div>
                </div>

                <Button
                  onClick={closeModal}
                  className="h-11 w-full rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Got it
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TokenBadge({
  code,
  accent,
  ring = "",
  small = false,
}: {
  code: Currency;
  accent: string;
  ring?: string;
  small?: boolean;
}) {
  const size = small ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[10px]";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white shadow-sm ring-1 ring-white/15",
        accent,
        size,
        ring && `ring-2 ${ring}`
      )}
    >
      {code === "USDT" ? "$" : code === "BTC" ? "₿" : "◎"}
    </span>
  );
}
