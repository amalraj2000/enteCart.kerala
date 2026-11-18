/** The cancellation rule, in one place (shown at checkout, on the order page, in the FAQ and enforced by the API). */
export const CANCELLABLE_STATUS = "Placed";
export const canCancel = (status: string) => status === CANCELLABLE_STATUS;
export const CANCEL_POLICY_SHORT = "You can cancel this order only while its status is “Placed”.";
export const CANCEL_POLICY = [
  "You can cancel your order from My Orders while its status is “Placed”.",
  "Once we confirm it (status “Confirmed”), the order can no longer be cancelled.",
  "Returns are not available.",
];
