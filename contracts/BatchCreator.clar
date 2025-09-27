(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DRUG-TYPE u101)
(define-constant ERR-INVALID-EXPIRY u102)
(define-constant ERR-INVALID-MFG-DATE u103)
(define-constant ERR-INVALID-BATCH-SIZE u104)
(define-constant ERR-INVALID-HASH u105)
(define-constant ERR-BATCH-ALREADY-EXISTS u106)
(define-constant ERR-BATCH-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MIN-TEMP u110)
(define-constant ERR-INVALID-MAX-TEMP u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-BATCHES-EXCEEDED u114)
(define-constant ERR-INVALID-LOCATION u115)
(define-constant ERR-INVALID-CURRENCY u116)
(define-constant ERR-INVALID-STATUS u117)
(define-constant ERR-INVALID-MANUFACTURER u118)
(define-constant ERR-INVALID-COMPOSITION u119)
(define-constant ERR-INVALID-DOSAGE u120)

(define-data-var next-batch-id uint u0)
(define-data-var max-batches uint u10000)
(define-data-var creation-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map batches
  uint
  {
    drug-type: (string-utf8 50),
    expiry-date: uint,
    mfg-date: uint,
    batch-size: uint,
    initial-hash: (buff 32),
    timestamp: uint,
    manufacturer: principal,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool,
    min-temp: int,
    max-temp: int,
    composition: (string-utf8 200),
    dosage: (string-utf8 50)
  }
)

(define-map batches-by-hash
  (buff 32)
  uint)

(define-map batch-updates
  uint
  {
    update-expiry: uint,
    update-batch-size: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-batch (id uint))
  (map-get? batches id)
)

(define-read-only (get-batch-updates (id uint))
  (map-get? batch-updates id)
)

(define-read-only (is-batch-registered (hash (buff 32)))
  (is-some (map-get? batches-by-hash hash))
)

(define-private (validate-drug-type (type (string-utf8 50)))
  (if (and (> (len type) u0) (<= (len type) u50))
      (ok true)
      (err ERR-INVALID-DRUG-TYPE))
)

(define-private (validate-expiry (expiry uint))
  (if (> expiry block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)

(define-private (validate-mfg-date (date uint))
  (if (<= date block-height)
      (ok true)
      (err ERR-INVALID-MFG-DATE))
)

(define-private (validate-batch-size (size uint))
  (if (> size u0)
      (ok true)
      (err ERR-INVALID-BATCH-SIZE))
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-temp (temp int))
  (if (<= temp i0)
      (ok true)
      (err ERR-INVALID-MIN-TEMP))
)

(define-private (validate-max-temp (temp int))
  (if (>= temp i0)
      (ok true)
      (err ERR-INVALID-MAX-TEMP))
)

(define-private (validate-composition (comp (string-utf8 200)))
  (if (<= (len comp) u200)
      (ok true)
      (err ERR-INVALID-COMPOSITION))
)

(define-private (validate-dosage (dos (string-utf8 50)))
  (if (<= (len dos) u50)
      (ok true)
      (err ERR-INVALID-DOSAGE))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-batches (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-BATCHES-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-batches new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-batch
  (drug-type (string-utf8 50))
  (expiry-date uint)
  (mfg-date uint)
  (batch-size uint)
  (initial-hash (buff 32))
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (min-temp int)
  (max-temp int)
  (composition (string-utf8 200))
  (dosage (string-utf8 50))
)
  (let (
        (next-id (var-get next-batch-id))
        (current-max (var-get max-batches))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-BATCHES-EXCEEDED))
    (try! (validate-drug-type drug-type))
    (try! (validate-expiry expiry-date))
    (try! (validate-mfg-date mfg-date))
    (try! (validate-batch-size batch-size))
    (try! (validate-hash initial-hash))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-temp min-temp))
    (try! (validate-max-temp max-temp))
    (try! (validate-composition composition))
    (try! (validate-dosage dosage))
    (asserts! (is-none (map-get? batches-by-hash initial-hash)) (err ERR-BATCH-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set batches next-id
      {
        drug-type: drug-type,
        expiry-date: expiry-date,
        mfg-date: mfg-date,
        batch-size: batch-size,
        initial-hash: initial-hash,
        timestamp: block-height,
        manufacturer: tx-sender,
        location: location,
        currency: currency,
        status: true,
        min-temp: min-temp,
        max-temp: max-temp,
        composition: composition,
        dosage: dosage
      }
    )
    (map-set batches-by-hash initial-hash next-id)
    (var-set next-batch-id (+ next-id u1))
    (print { event: "batch-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-batch
  (batch-id uint)
  (update-expiry uint)
  (update-batch-size uint)
)
  (let ((batch (map-get? batches batch-id)))
    (match batch
      b
        (begin
          (asserts! (is-eq (get manufacturer b) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-expiry update-expiry))
          (try! (validate-batch-size update-batch-size))
          (map-set batches batch-id
            {
              drug-type: (get drug-type b),
              expiry-date: update-expiry,
              mfg-date: (get mfg-date b),
              batch-size: update-batch-size,
              initial-hash: (get initial-hash b),
              timestamp: block-height,
              manufacturer: (get manufacturer b),
              location: (get location b),
              currency: (get currency b),
              status: (get status b),
              min-temp: (get min-temp b),
              max-temp: (get max-temp b),
              composition: (get composition b),
              dosage: (get dosage b)
            }
          )
          (map-set batch-updates batch-id
            {
              update-expiry: update-expiry,
              update-batch-size: update-batch-size,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "batch-updated", id: batch-id })
          (ok true)
        )
      (err ERR-BATCH-NOT-FOUND)
    )
  )
)

(define-public (get-batch-count)
  (ok (var-get next-batch-id))
)

(define-public (check-batch-existence (hash (buff 32)))
  (ok (is-batch-registered hash))
)