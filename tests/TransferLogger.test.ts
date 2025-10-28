import { describe, it, expect, beforeEach } from "vitest";
import { bufferCV } from "@stacks/transactions";

const ERR_BATCH_NOT_FOUND = 101;
const ERR_PARTICIPANT_NOT_FOUND = 102;
const ERR_INVALID_TRANSFER = 103;
const ERR_STATUS_INACTIVE = 106;
const ERR_SELF_TRANSFER = 108;
const ERR_MAX_TRANSFERS = 109;

interface Transfer {
  batchId: number;
  fromParticipant: number;
  toParticipant: number;
  timestamp: number;
  tempRecorded: number;
  hashProof: Uint8Array;
  status: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class TransferLoggerMock {
  state: {
    nextTransferId: number;
    maxTransfers: number;
    transfers: Map<number, Transfer>;
    batchCurrentOwner: Map<number, number>;
    participantTransfers: Map<number, number[]>;
    batches: Map<number, any>;
    participants: Map<number, any>;
  } = {
    nextTransferId: 0,
    maxTransfers: 100000,
    transfers: new Map(),
    batchCurrentOwner: new Map(),
    participantTransfers: new Map(),
    batches: new Map(),
    participants: new Map(),
  };
  blockHeight: number = 200;
  caller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextTransferId: 0,
      maxTransfers: 100000,
      transfers: new Map(),
      batchCurrentOwner: new Map(),
      participantTransfers: new Map(),
      batches: new Map(),
      participants: new Map(),
    };
    this.blockHeight = 200;
    this.caller = "ST1TEST";
  }

  mockBatch(batchId: number, data: any) {
    this.state.batches.set(batchId, data);
  }

  mockParticipant(id: number, data: any) {
    this.state.participants.set(id, data);
  }

  mockBatchOwner(batchId: number, ownerId: number) {
    this.state.batchCurrentOwner.set(batchId, ownerId);
  }

  logTransfer(
    batchId: number,
    toParticipant: number,
    tempRecorded: number,
    hashProof: Uint8Array
  ): Result<number> {
    if (this.state.nextTransferId >= this.state.maxTransfers)
      return { ok: false, value: ERR_MAX_TRANSFERS };
    const currentOwner = this.state.batchCurrentOwner.get(batchId);
    if (currentOwner === undefined)
      return { ok: false, value: ERR_BATCH_NOT_FOUND };
    if (currentOwner === toParticipant)
      return { ok: false, value: ERR_SELF_TRANSFER };

    const fromP = this.state.participants.get(currentOwner);
    const toP = this.state.participants.get(toParticipant);
    if (!fromP || !toP || !fromP.status || !toP.status)
      return { ok: false, value: ERR_STATUS_INACTIVE };

    const batch = this.state.batches.get(batchId);
    if (
      !batch ||
      batch.expiryDate <= this.blockHeight ||
      tempRecorded < batch.minTemp ||
      tempRecorded > batch.maxTemp ||
      !batch.status
    )
      return { ok: false, value: ERR_INVALID_TRANSFER };

    const id = this.state.nextTransferId;
    this.state.transfers.set(id, {
      batchId,
      fromParticipant: currentOwner,
      toParticipant,
      timestamp: this.blockHeight,
      tempRecorded,
      hashProof,
      status: "completed",
    });
    this.state.batchCurrentOwner.set(batchId, toParticipant);
    this.state.participantTransfers.set(
      currentOwner,
      [...(this.state.participantTransfers.get(currentOwner) || []), id].slice(
        -1000
      )
    );
    this.state.participantTransfers.set(
      toParticipant,
      [...(this.state.participantTransfers.get(toParticipant) || []), id].slice(
        -1000
      )
    );
    this.state.nextTransferId++;
    return { ok: true, value: id };
  }

  getTransfer(id: number): Transfer | null {
    return this.state.transfers.get(id) || null;
  }

  getCurrentOwner(batchId: number): number | undefined {
    return this.state.batchCurrentOwner.get(batchId);
  }

  getParticipantTransfers(id: number): number[] {
    return this.state.participantTransfers.get(id) || [];
  }

  getTransferCount(): Result<number> {
    return { ok: true, value: this.state.nextTransferId };
  }
}

describe("TransferLogger", () => {
  let contract: TransferLoggerMock;

  beforeEach(() => {
    contract = new TransferLoggerMock();
    contract.reset();
  });

  it("logs a transfer successfully", () => {
    contract.mockParticipant(1, { status: true });
    contract.mockParticipant(2, { status: true });
    contract.mockBatch(0, {
      expiryDate: 1000,
      minTemp: -10,
      maxTemp: 30,
      status: true,
    });
    contract.mockBatchOwner(0, 1);

    const hash = new Uint8Array(32).fill(1);
    const result = contract.logTransfer(0, 2, 25, hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const transfer = contract.getTransfer(0);
    expect(transfer?.batchId).toBe(0);
    expect(transfer?.fromParticipant).toBe(1);
    expect(transfer?.toParticipant).toBe(2);
    expect(transfer?.tempRecorded).toBe(25);
    expect(transfer?.hashProof).toEqual(hash);
    expect(transfer?.status).toBe("completed");
    expect(contract.getCurrentOwner(0)).toBe(2);
  });

  it("rejects self-transfer", () => {
    contract.mockParticipant(1, { status: true });
    contract.mockBatch(0, {
      expiryDate: 1000,
      minTemp: -10,
      maxTemp: 30,
      status: true,
    });
    contract.mockBatchOwner(0, 1);

    const hash = new Uint8Array(32).fill(2);
    const result = contract.logTransfer(0, 1, 20, hash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SELF_TRANSFER);
  });

  it("rejects inactive participant", () => {
    contract.mockParticipant(1, { status: true });
    contract.mockParticipant(2, { status: false });
    contract.mockBatch(0, {
      expiryDate: 1000,
      minTemp: -10,
      maxTemp: 30,
      status: true,
    });
    contract.mockBatchOwner(0, 1);

    const hash = new Uint8Array(32).fill(3);
    const result = contract.logTransfer(0, 2, 20, hash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_STATUS_INACTIVE);
  });

  it("rejects expired batch", () => {
    contract.mockParticipant(1, { status: true });
    contract.mockParticipant(2, { status: true });
    contract.mockBatch(0, {
      expiryDate: 100,
      minTemp: -10,
      maxTemp: 30,
      status: true,
    });
    contract.mockBatchOwner(0, 1);

    const hash = new Uint8Array(32).fill(4);
    const result = contract.logTransfer(0, 2, 20, hash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TRANSFER);
  });

  it("rejects temperature violation", () => {
    contract.mockParticipant(1, { status: true });
    contract.mockParticipant(2, { status: true });
    contract.mockBatch(0, {
      expiryDate: 1000,
      minTemp: -10,
      maxTemp: 30,
      status: true,
    });
    contract.mockBatchOwner(0, 1);

    const hash = new Uint8Array(32).fill(5);
    const result = contract.logTransfer(0, 2, 40, hash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TRANSFER);
  });

  it("enforces max transfer limit", () => {
    contract.state.nextTransferId = 100000;
    const result = contract.logTransfer(0, 1, 20, new Uint8Array(32).fill(8));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_TRANSFERS);
  });

  it("returns correct transfer count", () => {
    contract.mockParticipant(1, { status: true });
    contract.mockParticipant(2, { status: true });
    contract.mockBatch(0, {
      expiryDate: 1000,
      minTemp: -10,
      maxTemp: 30,
      status: true,
    });
    contract.mockBatchOwner(0, 1);

    contract.logTransfer(0, 2, 20, new Uint8Array(32).fill(9));
    contract.logTransfer(0, 1, 21, new Uint8Array(32).fill(10));

    const result = contract.getTransferCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });
});
