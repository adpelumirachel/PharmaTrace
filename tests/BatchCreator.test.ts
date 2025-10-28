import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, intCV, bufferCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DRUG_TYPE = 101;
const ERR_INVALID_EXPIRY = 102;
const ERR_INVALID_MFG_DATE = 103;
const ERR_INVALID_BATCH_SIZE = 104;
const ERR_INVALID_HASH = 105;
const ERR_BATCH_ALREADY_EXISTS = 106;
const ERR_BATCH_NOT_FOUND = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_MIN_TEMP = 110;
const ERR_INVALID_MAX_TEMP = 111;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_MAX_BATCHES_EXCEEDED = 114;
const ERR_INVALID_LOCATION = 115;
const ERR_INVALID_CURRENCY = 116;
const ERR_INVALID_COMPOSITION = 119;
const ERR_INVALID_DOSAGE = 120;

interface Batch {
  drugType: string;
  expiryDate: number;
  mfgDate: number;
  batchSize: number;
  initialHash: Uint8Array;
  timestamp: number;
  manufacturer: string;
  location: string;
  currency: string;
  status: boolean;
  minTemp: number;
  maxTemp: number;
  composition: string;
  dosage: string;
}

interface BatchUpdate {
  updateExpiry: number;
  updateBatchSize: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class BatchCreatorMock {
  state: {
    nextBatchId: number;
    maxBatches: number;
    creationFee: number;
    authorityContract: string | null;
    batches: Map<number, Batch>;
    batchUpdates: Map<number, BatchUpdate>;
    batchesByHash: Map<string, number>;
  } = {
    nextBatchId: 0,
    maxBatches: 10000,
    creationFee: 500,
    authorityContract: null,
    batches: new Map(),
    batchUpdates: new Map(),
    batchesByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextBatchId: 0,
      maxBatches: 10000,
      creationFee: 500,
      authorityContract: null,
      batches: new Map(),
      batchUpdates: new Map(),
      batchesByHash: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createBatch(
    drugType: string,
    expiryDate: number,
    mfgDate: number,
    batchSize: number,
    initialHash: Uint8Array,
    location: string,
    currency: string,
    minTemp: number,
    maxTemp: number,
    composition: string,
    dosage: string
  ): Result<number> {
    if (this.state.nextBatchId >= this.state.maxBatches) return { ok: false, value: ERR_MAX_BATCHES_EXCEEDED };
    if (!drugType || drugType.length > 50) return { ok: false, value: ERR_INVALID_DRUG_TYPE };
    if (expiryDate <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (mfgDate > this.blockHeight) return { ok: false, value: ERR_INVALID_MFG_DATE };
    if (batchSize <= 0) return { ok: false, value: ERR_INVALID_BATCH_SIZE };
    if (initialHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minTemp > 0) return { ok: false, value: ERR_INVALID_MIN_TEMP };
    if (maxTemp < 0) return { ok: false, value: ERR_INVALID_MAX_TEMP };
    if (composition.length > 200) return { ok: false, value: ERR_INVALID_COMPOSITION };
    if (dosage.length > 50) return { ok: false, value: ERR_INVALID_DOSAGE };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const hashKey = initialHash.toString();
    if (this.state.batchesByHash.has(hashKey)) return { ok: false, value: ERR_BATCH_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextBatchId;
    const batch: Batch = {
      drugType,
      expiryDate,
      mfgDate,
      batchSize,
      initialHash,
      timestamp: this.blockHeight,
      manufacturer: this.caller,
      location,
      currency,
      status: true,
      minTemp,
      maxTemp,
      composition,
      dosage,
    };
    this.state.batches.set(id, batch);
    this.state.batchesByHash.set(hashKey, id);
    this.state.nextBatchId++;
    return { ok: true, value: id };
  }

  getBatch(id: number): Batch | null {
    return this.state.batches.get(id) || null;
  }

  updateBatch(id: number, updateExpiry: number, updateBatchSize: number): Result<boolean> {
    const batch = this.state.batches.get(id);
    if (!batch) return { ok: false, value: ERR_BATCH_NOT_FOUND };
    if (batch.manufacturer !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (updateExpiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (updateBatchSize <= 0) return { ok: false, value: ERR_INVALID_BATCH_SIZE };

    const updated: Batch = {
      ...batch,
      expiryDate: updateExpiry,
      batchSize: updateBatchSize,
      timestamp: this.blockHeight,
    };
    this.state.batches.set(id, updated);
    this.state.batchUpdates.set(id, {
      updateExpiry,
      updateBatchSize,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getBatchCount(): Result<number> {
    return { ok: true, value: this.state.nextBatchId };
  }

  checkBatchExistence(initialHash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.batchesByHash.has(initialHash.toString()) };
  }
}

describe("BatchCreator", () => {
  let contract: BatchCreatorMock;

  beforeEach(() => {
    contract = new BatchCreatorMock();
    contract.reset();
  });

  it("creates a batch successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      "Antibiotic",
      1000,
      50,
      10000,
      hash,
      "FactoryA",
      "STX",
      -10,
      30,
      "Active ingredients: XYZ",
      "500mg"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const batch = contract.getBatch(0);
    expect(batch?.drugType).toBe("Antibiotic");
    expect(batch?.expiryDate).toBe(1000);
    expect(batch?.mfgDate).toBe(50);
    expect(batch?.batchSize).toBe(10000);
    expect(batch?.initialHash).toEqual(hash);
    expect(batch?.location).toBe("FactoryA");
    expect(batch?.currency).toBe("STX");
    expect(batch?.minTemp).toBe(-10);
    expect(batch?.maxTemp).toBe(30);
    expect(batch?.composition).toBe("Active ingredients: XYZ");
    expect(batch?.dosage).toBe("500mg");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate batch hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.createBatch(
      "Antibiotic",
      1000,
      50,
      10000,
      hash,
      "FactoryA",
      "STX",
      -10,
      30,
      "Active ingredients: XYZ",
      "500mg"
    );
    const result = contract.createBatch(
      "Painkiller",
      2000,
      50,
      20000,
      hash,
      "FactoryB",
      "USD",
      -5,
      25,
      "Active ingredients: ABC",
      "250mg"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const hash = new Uint8Array(32).fill(2);
    const result = contract.createBatch(
      "Vaccine",
      1500,
      50,
      5000,
      hash,
      "LabC",
      "BTC",
      -20,
      10,
      "mRNA based",
      "2 doses"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects batch creation without authority contract", () => {
    const hash = new Uint8Array(32).fill(3);
    const result = contract.createBatch(
      "Syrup",
      800,
      50,
      2000,
      hash,
      "PlantD",
      "STX",
      -5,
      25,
      "Herbal extract",
      "10ml"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid expiry date", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(4);
    const result = contract.createBatch(
      "Tablet",
      0,
      50,
      10000,
      hash,
      "FactoryE",
      "USD",
      -10,
      30,
      "Vitamins",
      "1 daily"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EXPIRY);
  });

  it("rejects invalid batch size", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(5);
    const result = contract.createBatch(
      "Injection",
      1000,
      50,
      0,
      hash,
      "HospitalF",
      "BTC",
      -20,
      8,
      "Steroid",
      "IM"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BATCH_SIZE);
  });

  it("rejects invalid hash length", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(31).fill(6);
    const result = contract.createBatch(
      "Cream",
      1200,
      50,
      500,
      hash,
      "LabG",
      "STX",
      -10,
      30,
      "Topical",
      "Apply twice"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("updates a batch successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(7);
    contract.createBatch(
      "Capsule",
      1000,
      50,
      10000,
      hash,
      "FactoryH",
      "USD",
      -5,
      25,
      "Antacid",
      "1 after meal"
    );
    const result = contract.updateBatch(0, 1500, 15000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const batch = contract.getBatch(0);
    expect(batch?.expiryDate).toBe(1500);
    expect(batch?.batchSize).toBe(15000);
    const update = contract.state.batchUpdates.get(0);
    expect(update?.updateExpiry).toBe(1500);
    expect(update?.updateBatchSize).toBe(15000);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent batch", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateBatch(99, 1500, 15000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_NOT_FOUND);
  });

  it("rejects update by non-manufacturer", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(8);
    contract.createBatch(
      "Powder",
      1000,
      50,
      10000,
      hash,
      "PlantI",
      "BTC",
      -5,
      40,
      "Protein",
      "1 scoop"
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateBatch(0, 1500, 15000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
    const hash = new Uint8Array(32).fill(9);
    contract.createBatch(
      "Liquid",
      1000,
      50,
      10000,
      hash,
      "FactoryJ",
      "STX",
      -15,
      15,
      "Cough syrup",
      "5ml"
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority contract", () => {
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("returns correct batch count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = new Uint8Array(32).fill(10);
    const hash2 = new Uint8Array(32).fill(11);
    contract.createBatch(
      "Pill1",
      1000,
      50,
      10000,
      hash1,
      "FactoryK",
      "USD",
      -10,
      30,
      "Pain reliever",
      "2 daily"
    );
    contract.createBatch(
      "Pill2",
      2000,
      50,
      20000,
      hash2,
      "FactoryL",
      "BTC",
      -5,
      25,
      "Antibiotic",
      "3 daily"
    );
    const result = contract.getBatchCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks batch existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(12);
    contract.createBatch(
      "Ointment",
      1000,
      50,
      10000,
      hash,
      "LabM",
      "STX",
      -10,
      30,
      "Skin cream",
      "Apply as needed"
    );
    const result = contract.checkBatchExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(13);
    const result2 = contract.checkBatchExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects batch creation with invalid min temp", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(15);
    const result = contract.createBatch(
      "Serum",
      1000,
      50,
      10000,
      hash,
      "LabN",
      "USD",
      5,
      30,
      "Blood serum",
      "IV"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MIN_TEMP);
  });

  it("rejects batch creation with max batches exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxBatches = 1;
    const hash1 = new Uint8Array(32).fill(16);
    contract.createBatch(
      "Drug1",
      1000,
      50,
      10000,
      hash1,
      "FactoryO",
      "BTC",
      -10,
      30,
      "Formula1",
      "Dose1"
    );
    const hash2 = new Uint8Array(32).fill(17);
    const result = contract.createBatch(
      "Drug2",
      2000,
      50,
      20000,
      hash2,
      "FactoryP",
      "STX",
      -5,
      25,
      "Formula2",
      "Dose2"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_BATCHES_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });
});