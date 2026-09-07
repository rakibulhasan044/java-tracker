# Capstone Project: Leaves Commerce — Core Platform (MVP)

**Type:** Modular Monolith · Spring Boot · Resume Flagship Project
**Estimated Duration:** 15–20 days (Weeks 33–35 of the roadmap)
**Prerequisite Knowledge:** Everything through Phase 4, Week 32 (Core Java, DSA, PostgreSQL, Spring Boot fundamentals, JPA, Security/JWT, Testing, AOP)
**Reference Basis:** Scoped down from the Neurosoftic Leaves Commerce SRS/Developer Guide — this document trims a genuinely enterprise-scale spec (HRM, CRM, full accounting, multi-warehouse) down to a **single-developer, fresher-appropriate** build that still demonstrates production-grade backend patterns.

---

## 1. Why This Project

Most fresher portfolios have a "CRUD Spring Boot app." This project is designed to stand out because it forces you to solve problems real backend teams solve every day:

- Modeling a **product catalog that isn't hard-coded to one category** (dynamic attributes/variants)
- Treating **inventory and money as ledgers**, not fields you overwrite
- Separating **authorization from authentication**, with a real RBAC model
- Handling **payment verification that can't be trusted from the client**
- Writing **order snapshots** so historical data doesn't silently change when prices update later

If you can explain *why* you built it this way in an interview, this project alone can carry your resume.

---

## 2. Scope Decision — What's In, What's Out

To fit 15–20 days as a solo fresher project, this MVP **intentionally excludes**: HRM, CRM, full double-entry accounting, courier integration, multi-warehouse transfers, and wholesale pricing tiers. Those are covered separately in the **microservices decomposition capstone** (Week 44) if you want to extend further. Keep discipline here — resist scope creep.

**In scope:**
- RBAC (database-driven roles/permissions, Super Admin bypass)
- Dynamic catalog: categories → attributes → attribute values → products → variants
- Inventory as an append-only stock ledger
- Cart → Checkout → Order lifecycle with a real state machine
- Manual payment verification workflow (like bKash/bank transfer verification) **plus** one real/sandbox payment gateway adapter (Stripe test mode or similar)
- Order snapshotting (price/tax/discount frozen at order time)
- Audit logging for sensitive admin actions
- Global exception handling, validation, pagination
- OpenAPI/Swagger docs
- Unit + integration tests (Testcontainers for the DB)
- Dockerized deployment (Docker Compose: app + Postgres + Redis)

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Language/Framework | Java 17+, Spring Boot 3.x |
| Security | Spring Security + JWT (access + refresh token) |
| Persistence | PostgreSQL, Spring Data JPA / Hibernate |
| Migrations | Flyway |
| Caching | Redis (session/rate-limit, optional cart cache) |
| Docs | springdoc-openapi (Swagger UI) |
| Testing | JUnit 5, Mockito, Testcontainers, MockMvc |
| Build | Maven (or Gradle if you did Week 50 already) |
| Deployment | Docker + Docker Compose |

---

## 4. Data Model (Core Entities)

```sql
users(id, uuid, role_id FK, name, email, phone, password_hash, status, timestamps)
roles(id, name, slug, is_system, status)
permissions(id, code UNIQUE, name, module, status)
role_permissions(role_id FK, permission_id FK, UNIQUE(role_id, permission_id))
audit_logs(actor_user_id, module, action, entity_type, entity_id, before_json, after_json, created_at)

categories(id, parent_id self-FK, name, slug, status)
attributes(id, name, slug, input_type, is_variant_axis, status)
attribute_values(id, attribute_id FK, value, label, status)
category_attributes(category_id FK, attribute_id FK, is_required, is_variant_axis)

products(id, category_id FK, name, slug, description, status, created_by, timestamps)
product_variants(id, product_id FK, sku UNIQUE, regular_price, sale_price, status)
variant_attribute_values(variant_id FK, attribute_id FK, attribute_value_id FK, UNIQUE combo)

warehouses(id, name, code, status)                         -- single warehouse for MVP is fine
inventory_stocks(warehouse_id FK, variant_id FK, on_hand_qty, reserved_qty, available_qty, UNIQUE(warehouse_id, variant_id))
stock_movements(id, warehouse_id FK, variant_id FK, movement_type, qty_in, qty_out, reference_type, reference_id, occurred_at)

carts(id, customer_id FK nullable, session_id, status, expires_at)
cart_items(cart_id FK, variant_id FK, qty, unit_price_snapshot)

orders(id, order_no UNIQUE, customer_id FK, subtotal, discount, tax, shipping_charge, grand_total, paid_amount, due_amount, payment_status, order_status, placed_at)
order_items(order_id FK, variant_id FK, sku_snapshot, name_snapshot, qty, unit_price, unit_cost_snapshot, line_total)
order_status_history(order_id FK, from_status, to_status, changed_by, changed_at, note)

payment_providers(id, name, code, provider_type ENUM[GATEWAY, MANUAL], status)
payments(id, order_id FK, provider_id FK, amount, status, provider_transaction_id, paid_at)
manual_payment_submissions(payment_id FK, sender_account, transaction_id, proof_url, verification_status, verified_by, verified_at)
payment_webhook_events(provider_id FK, event_id UNIQUE, payload_json, processing_status, received_at)
```

**Key modeling rules (non-negotiable — this is the whole point of the project):**

1. **Never** add category-specific columns (`shoe_size`, `color`) to `products`. All variation comes from `attributes` + `attribute_values` + `variant_attribute_values`.
2. **Never** overwrite `inventory_stocks.on_hand_qty` directly from application code outside of a movement. Every stock change is a row in `stock_movements`; the stock table is a derived/cached total.
3. **Never** recalculate an old order's profit using today's product cost — `unit_cost_snapshot` on `order_items` is frozen at order time.
4. **Never** trust a `paid=true` flag from the browser — payment status changes only from server-side webhook/verification logic.

---

## 5. RBAC Design

- `role_id = 1` is reserved for **Super Admin** and bypasses permission checks entirely in code (`if (user.getRoleId() == 1) return ALLOW;`) — do **not** implement this by seeding thousands of permission rows; make it an explicit rule.
- Permissions are atomic strings: `product.create`, `order.confirm`, `payment.verify`, `stock.adjust`.
- Use a custom `@PreAuthorize("hasPermission('order.confirm')")` or a manual filter/interceptor checking `role_permissions`.
- Seed at least 3 roles for demo purposes: `SUPER_ADMIN`, `STAFF` (can verify payments, manage catalog), `CUSTOMER`.

---

## 6. Order State Machine

```
DRAFT → PENDING_PAYMENT → CONFIRMED → PROCESSING → PACKED → DELIVERED
                 ↓                                     
             CANCELLED                            RETURNED → REFUNDED
```

- Every transition writes a row to `order_status_history`.
- `CONFIRMED` only happens after payment is verified (manual) or webhook-confirmed (gateway) — never from the checkout request itself.
- Stock is **reserved** at `PENDING_PAYMENT` and converted to a real `stock_movements` deduction at `CONFIRMED`. Cancellation releases the reservation.

---

## 7. Payment Flow (the hardest and most valuable part)

Implement a `PaymentProvider` interface:

```java
public interface PaymentProvider {
    PaymentInitResult initiate(Order order, BigDecimal amount);
    PaymentVerifyResult verify(String providerTransactionId);
    void handleWebhook(String rawPayload, String signature);
    RefundResult refund(String providerTransactionId, BigDecimal amount);
}
```

Implement **two** providers:
1. `ManualPaymentProvider` — customer submits a transaction ID + sender account (simulating bKash/bank transfer); a `STAFF` user calls a `/payments/{id}/verify` endpoint to approve/reject. This is your RBAC + audit logging showcase.
2. `StripeSandboxProvider` (or any sandbox gateway) — real webhook signature verification, idempotent event processing (dedupe on `event_id` before processing).

**Critical safeguard to implement and be ready to explain in interviews:** webhook processing must be idempotent — replaying the same webhook event must not double-credit the order.

---

## 8. API Surface (minimum set)

```http
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/categories
POST   /api/v1/admin/categories                 [permission: category.create]
POST   /api/v1/admin/products                    [permission: product.create]
POST   /api/v1/admin/products/{id}/variants
GET    /api/v1/products?category=&page=&size=&sort=
GET    /api/v1/products/{slug}

POST   /api/v1/cart/items
GET    /api/v1/cart
POST   /api/v1/checkout

POST   /api/v1/orders/{id}/payments/manual        (customer submits proof)
POST   /api/v1/admin/payments/{id}/verify         [permission: payment.verify]
POST   /api/v1/payments/webhook/stripe            (no auth — signature verified)

GET    /api/v1/orders/{id}
PATCH  /api/v1/admin/orders/{id}/status           [permission: order.update]

POST   /api/v1/admin/stock/adjust                 [permission: stock.adjust]
GET    /api/v1/admin/audit-logs                   [permission: audit.view]
```

---

## 9. Day-by-Day Milestone Plan (15–20 Days)

| Days | Milestone | Deliverable |
|---|---|---|
| 1–2 | Project setup, Flyway baseline, RBAC tables + seed data, JWT auth (register/login/refresh) | Auth works end-to-end in Postman |
| 3–5 | Catalog model: categories, attributes, attribute_values, products, variants + admin CRUD endpoints | Can create a category with 2 attributes and generate a variant matrix |
| 6–7 | Public product browsing API: list with filters/pagination/sort, product detail by slug | Customer-facing read API complete |
| 8–9 | Inventory: warehouses, inventory_stocks, stock_movements, stock adjustment endpoint | Stock changes only via movements, verified by test |
| 10–11 | Cart + Checkout: cart CRUD, checkout validates stock/price, creates order in DRAFT/PENDING_PAYMENT, reserves stock | Order created with snapshot pricing |
| 12–13 | Payment: ManualPaymentProvider + verify endpoint with audit log entry; order confirms on verification | Manual payment flow works with RBAC enforced |
| 14 | Payment: StripeSandboxProvider with webhook signature verification + idempotency | Webhook replays don't double-process |
| 15 | Order status transitions + order_status_history, global exception handling, validation | Full order lifecycle testable |
| 16 | Testing: unit tests for services, MockMvc for controllers, Testcontainers for repository/integration tests | ≥60% meaningful coverage on core modules |
| 17 | Swagger/OpenAPI docs, pagination/response envelope consistency, audit logging on admin actions | Docs browsable at `/swagger-ui.html` |
| 18 | Dockerize: Dockerfile + docker-compose.yml (app + Postgres + Redis), environment config via profiles | `docker compose up` runs the whole stack |
| 19–20 | Polish: README with architecture diagram, seed/demo data script, Postman collection, buffer for bugs | Repo is demo-ready |

---

## 10. Definition of Done

- [ ] Backend enforces RBAC on every admin/staff endpoint; Super Admin bypass works without seeding extra rows
- [ ] New product categories can be modeled through attributes without any schema change
- [ ] Stock ledger reconciles: sum of `stock_movements` for a variant equals `inventory_stocks.on_hand_qty`
- [ ] An order's `order_items.unit_cost_snapshot` does not change even if the product's price changes later
- [ ] At least one payment provider verifies server-side (not trusting client-reported success)
- [ ] Webhook processing is provably idempotent (write a test that replays the same event twice)
- [ ] All admin-sensitive actions (payment verify, stock adjust, role change) appear in `audit_logs`
- [ ] `docker compose up` brings up a working system from a clean clone
- [ ] Swagger UI documents every endpoint
- [ ] Test suite passes in CI-style run (`mvn test` / `gradle test`)

---

## 11. Resume Bullet Suggestions

Use these as a starting point, edit to be honest about what you actually built:

- *"Designed and built a modular-monolith e-commerce backend in Spring Boot with a dynamic, attribute-driven product catalog supporting unlimited categories without schema changes."*
- *"Implemented an append-only inventory ledger and order-price-snapshotting system to guarantee historical financial accuracy."*
- *"Built a database-driven RBAC system with atomic permissions and a Super Admin bypass, enforced via custom Spring Security authorization logic."*
- *"Implemented idempotent payment webhook processing and a manual payment verification workflow with full audit logging."*
- *"Achieved [X]% test coverage using JUnit 5, Mockito and Testcontainers, including integration tests against a real Postgres instance."*

---

## 12. Where This Project Goes Next

This exact project is the base for the **Week 44 Microservices Decomposition Capstone** — you'll split it into `auth-service`, `catalog-service`, `order-service`, `payment-service`, and `notification-service`, connected via Kafka and Eureka. Keep this repo clean; you'll be branching from it.
