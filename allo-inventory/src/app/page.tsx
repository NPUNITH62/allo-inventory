import { ProductList } from "@/components/ProductList";

export const dynamic = "force-dynamic"; // always fresh stock data

export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Products</h1>
      <p className="text-slate-500 mb-6 text-sm">
        Reserve a product to hold it while you complete payment.
      </p>
      <ProductList />
    </div>
  );
}
