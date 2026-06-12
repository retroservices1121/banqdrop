// The swap point. Choosing the rails implementation is ONE line driven by env —
// not a refactor. The product imports `rails` from here and nothing else.
//
//   RAILS_PROVIDER=mock  -> mock provider (default; build + test with no vendor)
//   RAILS_PROVIDER=oms   -> Open Money Stack (wire when early-access keys arrive)
//   RAILS_PROVIDER=base  -> self-wired Base stack (Privy+Alchemy+MoonPay+Bridge)

import type { RailsProvider } from "./types";
import { mockRails } from "./mock/provider";

function selectRails(): RailsProvider {
  const choice = (process.env.RAILS_PROVIDER ?? "mock").toLowerCase();
  switch (choice) {
    case "mock":
      return mockRails;
    case "oms":
      // import("./oms/provider") wired in a later phase once keys exist.
      throw new Error(
        "RAILS_PROVIDER=oms but the OMS provider is not wired yet. Use 'mock' until early access lands."
      );
    case "base":
      throw new Error(
        "RAILS_PROVIDER=base but the Base stack is not wired yet. See CLAUDE-base-stack.md."
      );
    default:
      throw new Error(`Unknown RAILS_PROVIDER: ${choice}`);
  }
}

export const rails: RailsProvider = selectRails();
