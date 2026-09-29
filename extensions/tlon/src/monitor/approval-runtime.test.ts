// Tlon approval runtime tests cover replay provenance across upgrades.
import { describe, expect, it, vi } from "vitest";
import type { PendingApproval } from "../settings.js";
import { createTlonApprovalRuntime } from "./approval-runtime.js";

describe("approved DM replay provenance", () => {
  function createApprovalHarness(authenticatedSenderShip?: string) {
    const approval: PendingApproval = {
      id: "dm-legacy",
      type: "dm",
      requestingShip: "~bus",
      messagePreview: "hello",
      originalMessage: {
        messageId: "message-1",
        messageText: "hello",
        messageContent: [{ inline: ["hello"] }],
        timestamp: 1,
        ...(authenticatedSenderShip ? { authenticatedSenderShip } : {}),
      },
      timestamp: 1,
    };
    let pendingApprovals: PendingApproval[] = [approval];
    let dmAllowlist: string[] = [];
    const processApprovedMessage = vi.fn(async () => {});
    const runtime = { error: vi.fn(), exit: vi.fn(), log: vi.fn() };
    const api = {
      poke: vi.fn(async () => 1),
      scry: vi.fn(async () => []),
    };
    const approvalRuntime = createTlonApprovalRuntime({
      api,
      runtime,
      botShipName: "~zod",
      getPendingApprovals: () => pendingApprovals,
      setPendingApprovals: (approvals) => {
        pendingApprovals = approvals;
      },
      getCurrentSettings: () => ({}),
      setCurrentSettings: vi.fn(),
      getEffectiveDmAllowlist: () => dmAllowlist,
      setEffectiveDmAllowlist: (ships) => {
        dmAllowlist = ships;
      },
      getEffectiveOwnerShip: () => "~nec",
      processApprovedMessage,
      refreshWatchedChannels: vi.fn(async () => 0),
    });
    return { approvalRuntime, processApprovedMessage, runtime, getDmAllowlist: () => dmAllowlist };
  }

  it("does not replay pre-upgrade DM content without authenticated sender provenance", async () => {
    const harness = createApprovalHarness();

    await expect(harness.approvalRuntime.handleApprovalResponse("approve dm-legacy")).resolves.toBe(
      true,
    );

    expect(harness.getDmAllowlist()).toEqual(["~bus"]);
    expect(harness.processApprovedMessage).not.toHaveBeenCalled();
    expect(harness.runtime.log).toHaveBeenCalledWith(
      expect.stringContaining("authenticated sender provenance is unavailable"),
    );
  });

  it("replays content when the stored authenticated DM peer matches the approved ship", async () => {
    const harness = createApprovalHarness("~bus");

    await expect(harness.approvalRuntime.handleApprovalResponse("approve dm-legacy")).resolves.toBe(
      true,
    );

    expect(harness.processApprovedMessage).toHaveBeenCalledOnce();
  });
});
