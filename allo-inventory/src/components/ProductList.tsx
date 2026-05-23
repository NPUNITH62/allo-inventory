"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, MapPin, AlertCircle, Loader2 } from "lucide-react";

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  warehouses: WarehouseStock[];
}

export function ProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserving, setReserving] = useState<string | null>(null); // "productId:warehouseId"
  const [reserveError, setReserveError] = useState<string | null>(null);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      setProducts(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  async function handleReserve(productId: string, warehouseId: string) {
    setReserving(`${productId}:${warehouseId}`);
    setReserveError(null);

    try {
      const idempotencyKey = `reserve-${productId}-${warehouseId}-${Date.now()}`;
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setReserveError(data.error ?? "Not enough stock available.");
        return;
      }
      if (!res.ok) {
        setReserveError(data.error ?? "Something went wrong.");
        return;
      }

      router.push(`/checkout/${data.id}`);
    } catch {
      setReserveError("Network error. Please try again.");
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-500 w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      {reserveError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Could not reserve</p>
            <p className="text-sm">{reserveError}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-44 object-cover"
              />
            ) : (
              <div className="w-full h-44 bg-slate-100 flex items-center justify-center">
                <Package className="w-12 h-12 text-slate-300" />
              </div>
            )}

            <div className="p-4 flex flex-col flex-1">
              <h2 className="font-semibold text-slate-800 text-lg">{product.name}</h2>
              {product.description && (
                <p className="text-slate-500 text-sm mt-1 mb-3 line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="mt-auto space-y-2">
                {product.warehouses.map((wh) => (
                  <div
                    key={wh.warehouseId}
                    className="border border-slate-100 rounded-lg p-3 bg-slate-50"
                  >
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span className="font-medium text-slate-600">{wh.warehouseName}</span>
                      <span>·</span>
                      <span>{wh.warehouseLocation}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <StockBadge available={wh.available} />
                      <button
                        onClick={() => handleReserve(product.id, wh.warehouseId)}
                        disabled={
                          wh.available === 0 ||
                          reserving === `${product.id}:${wh.warehouseId}`
                        }
                        className="text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white
                          hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                          flex items-center gap-1.5 transition-colors"
                      >
                        {reserving === `${product.id}:${wh.warehouseId}` ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Reserving…
                          </>
                        ) : wh.available === 0 ? (
                          "Out of stock"
                        ) : (
                          "Reserve"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockBadge({ available }: { available: number }) {
  if (available === 0) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
        Out of stock
      </span>
    );
  }
  if (available <= 3) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
        Only {available} left
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
      {available} available
    </span>
  );
}
