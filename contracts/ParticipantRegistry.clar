(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-NAME u101)
(define-constant ERR-INVALID-ROLE u102)
(define-constant ERR-INVALID-LOCATION u103)
(define-constant ERR-PARTICIPANT-EXISTS u104)
(define-constant ERR-PARTICIPANT-NOT-FOUND u105)
(define-constant ERR-ROLE-NOT-ALLOWED u106)
(define-constant ERR-MAX-PARTICIPANTS u107)
(define-constant ERR-AUTHORITY-NOT-SET u108)

(define-data-var next-participant-id uint u0)
(define-data-var max-participants uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map participants
  uint
  { name: (string-utf8 100), role: (string-utf8 50), location: (string-utf8 100), status: bool, registered-at: uint, registrant: principal }
)

(define-map participants-by-name (string-utf8 100) uint)

(define-read-only (get-participant (id uint))
  (map-get? participants id)
)

(define-read-only (get-participant-by-name (name (string-utf8 100)))
  (map-get? participants-by-name name)
)

(define-read-only (is-participant-registered (name (string-utf8 100)))
  (is-some (map-get? participants-by-name name))
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100)) (ok true) (err ERR-INVALID-NAME))
)

(define-private (validate-role (role (string-utf8 50)))
  (if (or (is-eq role "manufacturer") (is-eq role "distributor") (is-eq role "wholesaler") (is-eq role "pharmacy") (is-eq role "regulator"))
      (ok true)
      (err ERR-INVALID-ROLE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100)) (ok true) (err ERR-INVALID-LOCATION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78)) (ok true) (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract principal))
  (begin
    (try! (validate-principal contract))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract))
    (ok true)
  )
)

(define-public (set-max-participants (limit uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (> limit u0) (err ERR-MAX-PARTICIPANTS))
    (var-set max-participants limit)
    (ok true)
  )
)

(define-public (register-participant
  (name (string-utf8 100))
  (role (string-utf8 50))
  (location (string-utf8 100))
)
  (let (
        (next-id (var-get next-participant-id))
        (max-limit (var-get max-participants))
      )
    (asserts! (< next-id max-limit) (err ERR-MAX-PARTICIPANTS))
    (try! (validate-name name))
    (try! (validate-role role))
    (try! (validate-location location))
    (asserts! (is-none (map-get? participants-by-name name)) (err ERR-PARTICIPANT-EXISTS))
    (map-set participants next-id
      { name: name, role: role, location: location, status: true, registered-at: block-height, registrant: tx-sender }
    )
    (map-set participants-by-name name next-id)
    (var-set next-participant-id (+ next-id u1))
    (ok next-id)
  )
)

(define-public (update-participant-status (id uint) (active bool))
  (let ((participant (unwrap! (map-get? participants id) (err ERR-PARTICIPANT-NOT-FOUND))))
    (asserts! (is-eq (get registrant participant) tx-sender) (err ERR-NOT-AUTHORIZED))
    (map-set participants id (merge participant { status: active }))
    (ok true)
  )
)

(define-public (get-participant-count)
  (ok (var-get next-participant-id))
)