# 🔬 PharmaTrace: Blockchain-Based Pharmaceutical Traceability

Welcome to PharmaTrace, an end-to-end traceability platform built on the Stacks blockchain using Clarity smart contracts! This project tackles the critical real-world problem of counterfeit drugs in the pharmaceutical supply chain, which causes thousands of deaths and billions in losses annually. By logging every step—from manufacturing to patient delivery—on an immutable ledger, PharmaTrace ensures authenticity, prevents fakes, enables quick recalls, and provides transparent audits for regulators, manufacturers, distributors, pharmacies, and patients.

## ✨ Features

🔒 Immutable logging of drug batches from creation to consumption  
📦 Tokenization of drug batches as unique NFTs for verifiable ownership  
🚚 Real-time tracking of transfers between supply chain participants  
🛡️ Anti-counterfeit verification at any point in the chain  
🚨 Rapid recall mechanisms for contaminated or expired batches  
📊 Audit trails and compliance reports for regulatory oversight  
👥 Role-based access for manufacturers, distributors, wholesalers, pharmacies, and patients  
✅ Integration with IoT devices for automated logging (e.g., temperature monitoring)  
🛑 Prevention of duplicate or unauthorized entries  

## 🛠 How It Works

PharmaTrace leverages 8 interconnected Clarity smart contracts to create a secure, decentralized system. Each contract handles a specific aspect of the supply chain, ensuring modularity and scalability. Here's a high-level overview:

### Core Smart Contracts
1. **ParticipantRegistry.clar**: Registers and verifies supply chain participants (e.g., manufacturers, distributors) with roles and KYC-like proofs to ensure only authorized entities participate.
2. **BatchCreator.clar**: Allows manufacturers to create new drug batches, generating a unique NFT-like token with metadata (e.g., drug type, expiry, manufacturing date, and initial hash).
3. **TransferLogger.clar**: Logs ownership transfers between participants, updating the batch's chain of custody with timestamps and signatures to maintain immutability.
4. **VerificationEngine.clar**: Enables anyone to verify a batch's authenticity by checking its history against the ledger, flagging any discrepancies or unauthorized changes.
5. **RecallManager.clar**: Triggers and manages recalls for specific batches, notifying downstream participants and locking transfers for affected items.
6. **AuditTrail.clar**: Provides query functions for generating immutable audit reports, useful for regulators to trace compliance and investigate issues.
7. **ComplianceChecker.clar**: Enforces rules like expiry checks or temperature thresholds (integrated via oracles) before allowing transfers.
8. **PatientVerifier.clar**: Allows end-users (patients) to scan and verify drug authenticity via a mobile app, logging the final consumption step.

### For Manufacturers
- Register your entity using `ParticipantRegistry`.
- Create a batch with `BatchCreator`, including a cryptographic hash of the drug's details.
- Transfer to distributors via `TransferLogger`.

Your batches are now traceable and protected against tampering!

### For Distributors/Wholesalers/Pharmacies
- Verify incoming batches with `VerificationEngine`.
- Log transfers using `TransferLogger`.
- Check compliance rules with `ComplianceChecker` before proceeding.

Seamless handoffs with built-in fraud detection.

### For Patients/Verifiers
- Use `PatientVerifier` to confirm a drug's journey from manufacturer to your hands.
- Query details via `AuditTrail` for peace of mind.

Instant authenticity checks via QR codes or apps.

### For Regulators
- Access full histories through `AuditTrail` and `RecallManager` for oversight and enforcement.

Boom! A counterfeit-proof supply chain that's transparent and efficient. This setup solves real issues like the WHO's estimate of 10% counterfeit drugs in low-income countries by making forgery economically unviable through blockchain immutability.