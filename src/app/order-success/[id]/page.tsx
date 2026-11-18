import Link from "next/link";
export default async function Success({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-700">✓</div>
      <h1 className="mt-4 text-2xl font-bold text-brand-700">Order placed!</h1>
      <p className="mt-2 text-gray-600">Your order <b>#{id}</b> has been confirmed. Please keep cash ready — payment is Cash on Delivery.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/orders" className="btn-primary">View my orders</Link>
        <Link href="/" className="btn-outline">Continue shopping</Link>
      </div>
    </div>
  );
}
