(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-BATCH-NOT-FOUND u101)
(define-constant ERR-PARTICIPANT-NOT-FOUND u102)
(define-constant ERR-INVALID-TRANSFER u103)
(define-constant ERR-BATCH-EXPIRED u104)
(define-constant ERR-TEMP-VIOLATION u105)
(define-constant ERR-STATUS-INACTIVE u106)
(define-constant ERR-TRANSFER-ALREADY-LOGGED u107)
(define-constant ERR-SELF-TRANSFER u108)
(define-constant ERR-MAX-TRANSFERS u109)

(define-data-var next-transfer-id uint u0)
(define-data-var max-transfers uint u100000)

(define-map transfers
  uint
  {
    batch-id: uint,
    from-participant: uint,
    to-participant: uint,
    timestamp: uint,
    temp-recorded: int,
    hash-proof: (buff 32),
    status: (string-utf8 20)
  }
)

(define-map batch-current-owner uint uint)
(define-map participant-transfers uint (list 1000 uint))

(define-read-only (get-transfer (id uint))
  (map-get? transfers id)
)

(define-read-only (get-current-owner (batch-id uint))
  (map-get? batch-current-owner batch-id)
)

(define-read-only (get-participant-transfers (participant-id uint))
  (map-get? participant-transfers participant-id)
)

(define-private (is-participant-active (id uint))
  (let ((p (contract-call? 'ParticipantRegistry get-participant id)))
    (match p
      participant (get status participant)
      false
    )
  )
)

(define-private (is-batch-valid (batch-id uint) (current-time uint) (temp int))
  (let ((batch (contract-call? 'BatchCreator get-batch batch-id)))
    (match batch
      b
        (and
          (> (get expiry-date b) current-time)
          (>= temp (get min-temp b))
          (<= temp (get max-temp b))
          (get status b)
        )
      false
    )
  )
)

(define-public (log-transfer
  (batch-id uint)
  (to-participant uint)
  (temp-recorded int)
  (hash-proof (buff 32))
)
  (let (
        (transfer-id (var-get next-transfer-id))
        (current-owner (unwrap! (get-current-owner batch-id) (err ERR-BATCH-NOT-FOUND)))
        (from-participant current-owner)
      )
    (asserts! (< transfer-id (var-get max-transfers)) (err ERR-MAX-TRANSFERS))
    (asserts! (not (is-eq from-participant to-participant)) (err ERR-SELF-TRANSFER))
    (asserts! (is-participant-active from-participant) (err ERR-STATUS-INACTIVE))
    (asserts! (is-participant-active to-participant) (err ERR-STATUS-INACTIVE))
    (asserts! (is-batch-valid batch-id block-height temp-recorded) (err ERR-INVALID-TRANSFER))
    (map-set transfers transfer-id
      {
        batch-id: batch-id,
        from-participant: from-participant,
        to-participant: to-participant,
        timestamp: block-height,
        temp-recorded: temp-recorded,
        hash-proof: hash-proof,
        status: "completed"
      }
    )
    (map-set batch-current-owner batch-id to-participant)
    (map-set participant-transfers from-participant
      (unwrap! (as-max-len? (append (default-to (list) (map-get? participant-transfers from-participant)) transfer-id) u1000) (err ERR-MAX-TRANSFERS))
    )
    (map-set participant-transfers to-participant
      (unwrap! (as-max-len? (append (default-to (list) (map-get? participant-transfers to-participant)) transfer-id) u1000) (err ERR-MAX-TRANSFERS))
    )
    (var-set next-transfer-id (+ transfer-id u1))
    (print { event: "transfer-logged", id: transfer-id, batch: batch-id })
    (ok transfer-id)
  )
)

(define-public (get-transfer-count)
  (ok (var-get next-transfer-id))
)