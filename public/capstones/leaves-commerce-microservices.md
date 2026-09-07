# Capstone Project: Leaves Commerce — Microservices Decomposition

**Type:** Microservices · Spring Cloud · Resume Project #2
**Estimated Duration:** 12–15 days (Weeks 44–46 of the roadmap)
**Prerequisite:** Completed `leaves-commerce-core-mvp.md` (this project decomposes that monolith — don't start from scratch)
**Reference Basis:** Same Neurosoftic Leaves Commerce domain, now split into independently deployable services to demonstrate distributed-systems patterns for interviews.

---

## 1. Why Decompose a Working Monolith

Interviewers care less about "did you use microservices" and more about "do you understand *why* and *what breaks* when you split a system." This project exists to let you say, honestly:

> "I built the monolith first, identified real service boundaries around data ownership, then decomposed it — and I can explain the trade-offs I hit (distributed transactions, eventual consistency, network failure handling)."

That sentence, backed by a working repo, is worth more than either project alone.

---

## 2. Target Service Boundaries

| Service | Owns | Talks to |
|---|---|---|
| `auth-service` | users, roles, permissions, JWT issuing | Everyone validates JWT locally (no round-trip needed) or via a shared public key |
| `catalog-service` | categories, attributes, products, variants, inventory | Publishes `stock.reserved`, `stock.released` events |
| `order-service` | carts, orders, order_items, order_status_history | Calls catalog-service (stock check), publishes `order.placed`, `order.confirmed` events |
| `payment-service` | payments, manual_payment_submissions, webhook events | Consumes `order.placed`, publishes `payment.verified` / `payment.failed` |
| `notification-service` | notification log only (in-memory/log-based is fine) | Consumes `order.confirmed`, `payment.verified` and logs/simulates an email/SMS |

**Data ownership rule:** each service gets its **own PostgreSQL database** (or at minimum, its own schema). No service reads another service's tables directly — cross-service reads happen via REST call or via data replicated through events.

---

## 3. Tech Stack Additions (on top of the core project stack)

| Concern | Tool |
|---|---|
| Service registry | Netflix Eureka |
| API Gateway | Spring Cloud Gateway |
| Sync inter-service calls | OpenFeign or WebClient |
| Async events | Apache Kafka |
| Resilience | Resilience4j (circuit breaker, retry, timeout, fallback) |
| Config | Spring Cloud Config (optional) or per-service `application.yml` with profiles |
| Containers | Docker Compose for local, Kubernetes manifests for the "production" story |
| Tracing | Micrometer + a simple correlation/request ID propagated via header (full Zipkin/Jaeger optional stretch goal) |

---

## 4. Event Contracts (design these before writing code)

```json
order.placed          { "orderId": "", "customerId": "", "items": [{"variantId": "", "qty": 1}], "totalAmount": 0, "occurredAt": "" }
order.confirmed       { "orderId": "", "occurredAt": "" }
order.cancelled       { "orderId": "", "reason": "", "occurredAt": "" }
stock.reserved        { "orderId": "", "variantId": "", "qty": 1, "warehouseId": "" }
stock.reservation_failed { "orderId": "", "variantId": "", "reason": "" }
payment.verified      { "orderId": "", "paymentId": "", "amount": 0, "occurredAt": "" }
payment.failed        { "orderId": "", "reason": "", "occurredAt": "" }
```

Put these as versioned JSON schemas (or simple POJOs shared via a small `commerce-events-common` library module) so producer and consumer stay in sync.

---

## 5. The Hard Part: Distributed Order Flow

This is the sequence you must implement and be able to whiteboard in an interview:

1. Customer calls `POST /orders` on **order-service** (via Gateway).
2. order-service calls **catalog-service** synchronously (OpenFeign, wrapped in a Resilience4j circuit breaker) to validate stock and reserve it.
   - If catalog-service is down → circuit breaker opens → order-service returns a clean "try again" error instead of hanging.
3. order-service creates the order in `PENDING_PAYMENT`, publishes `order.placed` to Kafka.
4. payment-service consumes `order.placed`, waits for either manual verification or gateway webhook, then publishes `payment.verified` or `payment.failed`.
5. order-service consumes `payment.verified` → transitions order to `CONFIRMED`, publishes `order.confirmed`.
6. catalog-service consumes `order.confirmed` → converts the stock reservation into a permanent `stock_movements` deduction.
7. notification-service consumes `order.confirmed` and `payment.verified` → logs a "notification sent" event.

**If payment fails:** payment-service publishes `payment.failed` → order-service cancels the order → publishes `order.cancelled` → catalog-service releases the reservation.

This is a **saga** (choreography-based). Document the compensating actions clearly in your README — that's what interviewers probe on.

---

## 6. API Gateway Responsibilities

- Single entry point: `https://api.leaves.local/*`
- Routes `/auth/**` → auth-service, `/catalog/**` → catalog-service, `/orders/**` → order-service, `/payments/**` → payment-service
- Validates JWT once at the gateway (or delegates to each service — pick one approach and justify it)
- Centralized rate limiting (Resilience4j or Gateway's built-in RequestRateLimiter with Redis)

---

## 7. Day-by-Day Milestone Plan (12–15 Days)

| Days | Milestone | Deliverable |
|---|---|---|
| 1 | Split repo into a multi-module structure (or separate repos), set up Eureka server | 5 services registering with Eureka |
| 2–3 | Extract auth-service fully; other services validate JWT via shared public key (no network call needed) | Auth works standalone |
| 4–5 | Extract catalog-service with its own DB; migrate catalog + inventory tables | catalog-service runs independently |
| 6–7 | Extract order-service; wire OpenFeign call to catalog-service with Resilience4j circuit breaker + fallback | Order creation validates stock via network call |
| 8 | Set up Kafka (Docker Compose), define event contracts, publish `order.placed` | Event visible in Kafka topic |
| 9–10 | Extract payment-service, consume `order.placed`, implement manual + webhook verification, publish `payment.verified/failed` | End-to-end happy path works via events |
| 11 | order-service consumes `payment.verified/failed`, completes saga (confirm or cancel + release stock) | Full saga works, including the failure/compensation path |
| 12 | notification-service (simple consumer + log), API Gateway with routing + JWT validation + rate limiting | Gateway is the single entry point |
| 13 | Dockerize all 5 services + Kafka + 3 Postgres instances in one docker-compose.yml | `docker compose up` runs the whole system |
| 14 | Kubernetes manifests (Deployment/Service/ConfigMap/Secret) for at least 2 services as a demonstration | `kubectl apply` deploys to local K8s (minikube/kind) |
| 15 | README with architecture diagram, sequence diagram of the saga, and a "what I'd do differently at scale" section | Repo is interview-ready |

---

## 8. Definition of Done

- [ ] Each service has its own database/schema — verified by checking no cross-service SQL joins exist
- [ ] Order creation survives catalog-service being temporarily down (circuit breaker + fallback demonstrated)
- [ ] The full saga (order → payment → confirm → notify) works end-to-end via Kafka, provable with a demo script
- [ ] The failure/compensation path (payment fails → stock released → order cancelled) is implemented and tested
- [ ] API Gateway is the only public entry point; direct service ports are not exposed externally in the Docker Compose network
- [ ] `docker compose up` brings up all 5 services + Kafka + databases from a clean clone
- [ ] At least 2 services have Kubernetes manifests
- [ ] README includes an architecture diagram and a sequence diagram of the order saga

---

## 9. Resume Bullet Suggestions

- *"Decomposed a Spring Boot monolith into 5 independently deployable microservices with per-service databases, coordinated via a Kafka-based choreographed saga."*
- *"Implemented resilience patterns (circuit breaker, retry, fallback) with Resilience4j to prevent cascading failures across service boundaries."*
- *"Designed and documented an event-driven order fulfillment saga including compensating transactions for payment failure scenarios."*
- *"Deployed a 5-service system via Docker Compose locally and authored Kubernetes manifests for production-style deployment."*

---

## 10. Interview Talking Points to Prepare

Be ready to answer these — they're the actual reason to build this project:

1. "Why did you choose choreography over orchestration for the saga?"
2. "What happens if the `payment.verified` event is delivered twice?" (→ idempotent consumer, dedupe on orderId+eventId)
3. "How do you keep catalog-service and order-service data consistent if a network partition happens?" (→ eventual consistency, explain the trade-off honestly)
4. "Why does each service get its own database instead of sharing one?" (→ independent deployability, no schema coupling)
