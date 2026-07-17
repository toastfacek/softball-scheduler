"use client";

import { useRef } from "react";

import { startGolfPaymentLinkCheckoutAction } from "@/actions/golf-tournament-actions";

type GolfCheckoutButtonProps = {
  packageId: string;
  packageName: string;
  buttonLabel: string;
};

export function GolfCheckoutButton({
  packageId,
  packageName,
  buttonLabel,
}: GolfCheckoutButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="golf-package-action"
        type="button"
        aria-label={`${buttonLabel}: ${packageName}`}
        onClick={() => dialogRef.current?.showModal()}
      >
        <span>{buttonLabel}</span>
        <i aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        className="golf-checkout-dialog"
        aria-labelledby={`checkout-title-${packageId}`}
      >
        <form action={startGolfPaymentLinkCheckoutAction}>
          <input type="hidden" name="packageId" value={packageId} />
          <div className="golf-checkout-dialog-heading">
            <div>
              <span>Foursome registration included</span>
              <h3 id={`checkout-title-${packageId}`}>{packageName}</h3>
            </div>
            <button
              className="golf-checkout-dialog-close"
              type="button"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </div>

          <p>
            Add the four golfers who will play in your group. You’ll continue
            to Stripe to securely complete payment.
          </p>

          <div className="golf-checkout-player-grid">
            {[1, 2, 3, 4].map((slotNumber) => (
              <label key={slotNumber}>
                <span>Player {slotNumber}</span>
                <input
                  name={`player${slotNumber}`}
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  required
                />
              </label>
            ))}
          </div>

          <button className="golf-checkout-submit" type="submit">
            Continue to secure checkout
          </button>
          <small>Payment is processed securely by Stripe.</small>
        </form>
      </dialog>
    </>
  );
}
