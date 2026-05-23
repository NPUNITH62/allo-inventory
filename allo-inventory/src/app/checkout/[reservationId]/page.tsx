import { CheckoutView } from "@/components/CheckoutView";

export default function CheckoutPage({
  params,
}: {
  params: { reservationId: string };
}) {
  return <CheckoutView reservationId={params.reservationId} />;
}
