"use client";

import { useRef } from "react";

import { startGolfPaymentLinkCheckoutAction } from "@/actions/golf-tournament-actions";

type GolfCheckoutButtonProps = {
  packageId: string;
  packageName: string;
  buttonLabel: string;
  isSponsorship: boolean;
  includedPlayerCount: number;
  collectsPlayerNames: boolean;
};

export function GolfCheckoutButton({
  packageId,
  packageName,
  buttonLabel,
  isSponsorship,
  includedPlayerCount,
  collectsPlayerNames,
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
              <span>
                {includedPlayerCount === 4
                  ? "Foursome registration included"
                  : includedPlayerCount === 2
                    ? "Twosome registration"
                  : isSponsorship
                    ? "Sponsorship details"
                    : "Tournament registration"}
              </span>
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
            {isSponsorship
              ? "Share the best contact information for this sponsorship. You’ll continue to Stripe to securely complete payment."
              : `Add the ${includedPlayerCount === 2 ? "two" : "four"} golfers who will play in your group. You’ll continue to Stripe to securely complete payment.`}
          </p>

          {isSponsorship ? (
            <div className="golf-checkout-player-grid">
              <label>
                <span>Contact name</span>
                <input name="contactName" type="text" autoComplete="name" />
              </label>
              <label>
                <span>Business name</span>
                <input
                  name="businessName"
                  type="text"
                  autoComplete="organization"
                />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" autoComplete="email" />
              </label>
              <label>
                <span>Phone number</span>
                <input name="phone" type="tel" autoComplete="tel" />
              </label>
            </div>
          ) : null}

          {collectsPlayerNames ? (
            <div className="golf-checkout-player-grid">
              {Array.from(
                { length: includedPlayerCount },
                (_, index) => index + 1,
              ).map((slotNumber) => (
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
          ) : null}

          <button className="golf-checkout-submit" type="submit">
            Continue to secure checkout
          </button>
          <small>Payment is processed securely by Stripe.</small>
        </form>
      </dialog>
    </>
  );
}
