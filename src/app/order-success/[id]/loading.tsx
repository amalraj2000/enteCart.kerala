/** Shown the instant the customer is sent here after placing an order, while the server reads the order (so there is no blank pause). */
export default function Loading() {
  return (
    <div className="card mx-auto max-w-md p-10 text-center" role="status" aria-live="polite">
      <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-brand-700">Confirming your order…</h1>
      <p className="mt-2 text-gray-600">Just a moment.</p>
    </div>
  );
}
