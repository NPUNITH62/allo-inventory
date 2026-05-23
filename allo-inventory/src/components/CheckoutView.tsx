"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Package,
  MapPin,
  ShoppingCart,
} from "lucide-react";
import { Countdown } from "./Countdown";

type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  product: { name: string };
  warehouse: { name: string };
}

interface CheckoutViewProps {
  reservationId: string;
}

export function CheckoutView({ reservationId }: CheckoutViewProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Fetch the reservation from our API
    async function load() {
      try {
        const res = await fetch(`/api/reservations/${reservationId}`);
        if (!res.ok) throw new Error("Reservation not found");
        const data = await res.json();
        setReservation(data);
        if (data.status !== "PENDING" || new Date(data.expiresAt) < new Date()) {
          setExpired(data.status === "RELEASED" || data.status === "PENDING");
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reservationId]);

  const handleExpired = useCallback(() => {
    setExpired(true);
  }, []);

  async function handleConfirm() {
    setActionLoading("confirm");
    setActionError(null);
    try {
      const key = `confirm-${reservationId}-${Date.now()}`;
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });
      const data = await res.json();
      if (res.status === 410) {
        setActionError("Your reservation has expired. Please go back and reserve again.");
        setExpired(true);
        return;
      }
      if (!res.ok) {
        setActionError(data.error ?? "Something went wrong.");
        return;
      }
      setReservation(data);
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading("cancel");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Something went wrong.");
        return;
      }
      setReservation(data);
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-500 w-8 h-8" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error ?? "Reservation not found"}</span>
        </div>
        <button
          onClick={() => router.push("/")}
          className="mt-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to products
        </button>
      </div>
    );
  }

  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isPending = reservation.status === "PENDING" && !expired;

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={() => router.push("/")}
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to products
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-600" />
            <h1 className="font-semibold text-slate-800">Checkout</h1>
          </div>
          {isPending && (
            <Countdown expiresAt={reservation.expiresAt} onExpired={handleExpired} />
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status banner */}
          {isConfirmed && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Order confirmed!</p>
                <p className="text-sm">Your purchase was successful. Thank you!</p>
              </div>
            </div>
          )}

          {(isReleased || (expired && !isConfirmed)) && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg p-3">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">
                  {expired && reservation.status === "PENDING"
                    ? "Reservation expired"
                    : "Reservation cancelled"}
                </p>
                <p className="text-sm">The held stock has been released back to inventory.</p>
              </div>
            </div>
          )}

          {/* Reservation details */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Product</p>
                <p className="font-medium text-slate-800">{reservation.product.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Fulfilling warehouse</p>
                <p className="font-medium text-slate-800">{reservation.warehouse.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-xs text-slate-500">Quantity</p>
                <p className="font-medium text-slate-800">{reservation.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <StatusBadge status={reservation.status} expired={expired} />
              </div>
            </div>
          </div>

          {/* Action error */}
          {actionError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{actionError}</p>
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                  text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {actionLoading === "confirm" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Confirm purchase</>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                className="flex-1 flex items-center justify-center gap-2 border border-slate-300
                  text-slate-700 hover:bg-slate-50 font-medium py-2.5 rounded-lg transition-colors
                  disabled:opacity-60"
              >
                {actionLoading === "cancel" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Cancel</>
                )}
              </button>
            </div>
          )}

          {(isReleased || (expired && !isConfirmed)) && (
            <button
              onClick={() => router.push("/")}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Browse products again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  expired,
}: {
  status: ReservationStatus;
  expired: boolean;
}) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Confirmed
      </span>
    );
  }
  if (status === "RELEASED" || expired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
        <XCircle className="w-3 h-3" /> {expired && status === "PENDING" ? "Expired" : "Released"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}
