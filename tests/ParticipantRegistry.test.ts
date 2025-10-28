import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_NAME = 101;
const ERR_INVALID_ROLE = 102;
const ERR_INVALID_LOCATION = 103;
const ERR_PARTICIPANT_EXISTS = 104;
const ERR_PARTICIPANT_NOT_FOUND = 105;
const ERR_MAX_PARTICIPANTS = 107;
const ERR_AUTHORITY_NOT_SET = 108;

interface Participant {
  name: string;
  role: string;
  location: string;
  status: boolean;
  registeredAt: number;
  registrant: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ParticipantRegistryMock {
  state: {
    nextParticipantId: number;
    maxParticipants: number;
    authorityContract: string | null;
    participants: Map<number, Participant>;
    participantsByName: Map<string, number>;
  } = {
    nextParticipantId: 0,
    maxParticipants: 1000,
    authorityContract: null,
    participants: new Map(),
    participantsByName: new Map(),
  };
  blockHeight: number = 100;
  caller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextParticipantId: 0,
      maxParticipants: 1000,
      authorityContract: null,
      participants: new Map(),
      participantsByName: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1TEST";
  }

  setAuthorityContract(contract: string): Result<boolean> {
    if (contract === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    this.state.authorityContract = contract;
    return { ok: true, value: true };
  }

  setMaxParticipants(limit: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (limit <= 0) return { ok: false, value: ERR_MAX_PARTICIPANTS };
    this.state.maxParticipants = limit;
    return { ok: true, value: true };
  }

  registerParticipant(name: string, role: string, location: string): Result<number> {
    if (this.state.nextParticipantId >= this.state.maxParticipants) return { ok: false, value: ERR_MAX_PARTICIPANTS };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_NAME };
    if (!["manufacturer","distributor","wholesaler","pharmacy","regulator"].includes(role)) return { ok: false, value: ERR_INVALID_ROLE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (this.state.participantsByName.has(name)) return { ok: false, value: ERR_PARTICIPANT_EXISTS };

    const id = this.state.nextParticipantId;
    this.state.participants.set(id, {
      name, role, location, status: true, registeredAt: this.blockHeight, registrant: this.caller
    });
    this.state.participantsByName.set(name, id);
    this.state.nextParticipantId++;
    return { ok: true, value: id };
  }

  getParticipant(id: number): Participant | null {
    return this.state.participants.get(id) || null;
  }

  updateParticipantStatus(id: number, active: boolean): Result<boolean> {
    const p = this.state.participants.get(id);
    if (!p) return { ok: false, value: ERR_PARTICIPANT_NOT_FOUND };
    if (p.registrant !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.participants.set(id, { ...p, status: active });
    return { ok: true, value: true };
  }

  getParticipantCount(): Result<number> {
    return { ok: true, value: this.state.nextParticipantId };
  }

  isParticipantRegistered(name: string): Result<boolean> {
    return { ok: true, value: this.state.participantsByName.has(name) };
  }
}

describe("ParticipantRegistry", () => {
  let contract: ParticipantRegistryMock;

  beforeEach(() => {
    contract = new ParticipantRegistryMock();
    contract.reset();
  });

  it("registers a participant successfully", () => {
    const result = contract.registerParticipant("Acme Pharma", "manufacturer", "New York");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const p = contract.getParticipant(0);
    expect(p?.name).toBe("Acme Pharma");
    expect(p?.role).toBe("manufacturer");
    expect(p?.location).toBe("New York");
    expect(p?.status).toBe(true);
    expect(p?.registrant).toBe("ST1TEST");
  });

  it("rejects duplicate participant name", () => {
    contract.registerParticipant("Acme Pharma", "manufacturer", "New York");
    const result = contract.registerParticipant("Acme Pharma", "distributor", "LA");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PARTICIPANT_EXISTS);
  });

  it("rejects invalid role", () => {
    const result = contract.registerParticipant("Bad Role Co", "invalid", "Somewhere");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ROLE);
  });

  it("rejects empty name", () => {
    const result = contract.registerParticipant("", "manufacturer", "NY");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NAME);
  });

  it("updates participant status successfully", () => {
    contract.registerParticipant("Acme Pharma", "manufacturer", "New York");
    const result = contract.updateParticipantStatus(0, false);
    expect(result.ok).toBe(true);
    const p = contract.getParticipant(0);
    expect(p?.status).toBe(false);
  });

  it("rejects status update by non-registrant", () => {
    contract.registerParticipant("Acme Pharma", "manufacturer", "New York");
    contract.caller = "ST2FAKE";
    const result = contract.updateParticipantStatus(0, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("returns correct participant count", () => {
    contract.registerParticipant("P1", "manufacturer", "A");
    contract.registerParticipant("P2", "distributor", "B");
    const result = contract.getParticipantCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks participant existence correctly", () => {
    contract.registerParticipant("Exists Co", "pharmacy", "C");
    const r1 = contract.isParticipantRegistered("Exists Co");
    const r2 = contract.isParticipantRegistered("Not Exists");
    expect(r1.ok).toBe(true);
    expect(r1.value).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r2.value).toBe(false);
  });
});