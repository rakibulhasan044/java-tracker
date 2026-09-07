# Capstone Project: AI-Powered Commerce Support Assistant (RAG)

**Type:** Spring AI · Retrieval-Augmented Generation · Resume Project #3
**Estimated Duration:** 12–15 days (Weeks 47–48 of the roadmap)
**Prerequisite:** Week 45–46 Spring AI topics (ChatClient, embeddings, vector stores, tool calling); ideally built on top of `leaves-commerce-core-mvp.md` so the assistant has real data to reason over
**Why this project:** RAG is currently one of the highest-signal "I understand modern AI application patterns, not just prompting" projects a backend developer can show. Doing it *inside* your existing commerce backend — not a toy notebook — is what makes it resume-credible.

---

## 1. What You're Building

A customer support assistant that:
1. Answers questions grounded in **your actual product catalog and policy documents** (not hallucinated)
2. Can **call real backend tools** — check a live order's status, check current stock — not just retrieve static text
3. Remembers conversation context within a session
4. Streams its response token-by-token like a real chat product
5. Refuses to answer things outside its scope (basic guardrails)

Think of it as a scoped-down version of what Amazon's or Shopify's support chat does internally.

---

## 2. Architecture Overview

```
Customer/Admin
      │
      ▼
POST /api/v1/assistant/chat  (SSE streaming)
      │
      ▼
ChatClient (Spring AI)
      │
      ├── RetrievalAdvisor ──► VectorStore (pgvector) ──► embedded policy docs + product descriptions
      │
      ├── ChatMemoryAdvisor ──► per-session conversation history (Redis or in-memory)
      │
      └── Tool Callbacks ──► OrderLookupTool, StockCheckTool  ──► calls into order-service / catalog-service (or the monolith)
```

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| AI Framework | Spring AI |
| Model provider | OpenAI-compatible API (or Ollama locally for free iteration, e.g. `llama3` / `mistral`) |
| Vector store | PostgreSQL + `pgvector` extension |
| Embedding model | text-embedding-3-small (or a local embedding model via Ollama) |
| Chat memory | Redis-backed or in-memory `ChatMemory` |
| Document ingestion | Spring AI `DocumentReader` (PDF/Markdown), `TokenTextSplitter` |
| Streaming | Server-Sent Events (`Flux<String>` from a `@GetMapping(produces = TEXT_EVENT_STREAM_VALUE)`) |
| Guardrails | Simple input classification + system prompt constraints + output length limits |

---

## 4. Data to Ingest

Build a small `docs/` folder with:
- 5–10 markdown/PDF files: shipping policy, return policy, payment methods FAQ, warranty policy, size guide
- Product descriptions pulled from your `products`/`product_variants` tables (sync via a scheduled job or a one-time ingestion script)

Chunk these with `TokenTextSplitter` (aim for ~300-500 token chunks with slight overlap), embed them, and store in `pgvector` with metadata (`source`, `docType`, `productId` if applicable) so you can filter retrieval by type later.

---

## 5. Core Implementation Pieces

### 5.1 Ingestion Pipeline
```java
// Pseudocode structure — implement for real
List<Document> docs = pdfReader.get();
List<Document> chunks = tokenTextSplitter.apply(docs);
vectorStore.add(chunks); // embeds + stores automatically via Spring AI
```
Expose this as an admin-only endpoint (`POST /admin/assistant/ingest`) so re-ingestion doesn't require a redeploy.

### 5.2 RAG Query Endpoint
```java
ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(
        new QuestionAnswerAdvisor(vectorStore),
        new MessageChatMemoryAdvisor(chatMemory)
    )
    .build();

Flux<String> response = chatClient.prompt()
    .user(userMessage)
    .advisors(a -> a.param("chat_memory_conversation_id", sessionId))
    .stream()
    .content();
```

### 5.3 Tool Calling (the differentiator — don't skip this)
Define real tools the model can invoke:

```java
@Tool(description = "Look up the current status of an order by order number")
public OrderStatusResult getOrderStatus(String orderNumber) {
    // calls your real order-service/repository
}

@Tool(description = "Check current stock availability for a product variant SKU")
public StockResult checkStock(String sku) {
    // calls your real catalog-service/repository
}
```
Register these with the `ChatClient` so the model can decide, based on the conversation, whether to call them — e.g. "Where's my order #ORD-1042?" should trigger `getOrderStatus`, not a hallucinated answer.

### 5.4 Guardrails
- System prompt explicitly scopes the assistant to Leaves Commerce topics only, and instructs it to say "I don't have that information" rather than guessing when retrieval returns nothing relevant.
- Reject or redirect obviously off-topic/adversarial input (basic keyword/length checks are enough for MVP — don't over-engineer a full moderation pipeline).
- Log every prompt + token count + latency for cost observability (a simple `ai_interaction_logs` table is enough).

---

## 6. API Surface

```http
POST   /api/v1/admin/assistant/ingest        [permission: assistant.manage] — re-run document ingestion
GET    /api/v1/assistant/chat?sessionId=&message=   (SSE stream response)
GET    /api/v1/admin/assistant/logs           [permission: assistant.manage] — view interaction logs, token usage
```

---

## 7. Day-by-Day Milestone Plan (12–15 Days)

| Days | Milestone | Deliverable |
|---|---|---|
| 1 | Set up pgvector extension, Spring AI dependencies, configure model provider (OpenAI or Ollama) | ChatClient responds to a hardcoded prompt |
| 2 | Build the `docs/` policy/FAQ document set, implement ingestion pipeline (reader → splitter → vector store) | Documents embedded and searchable via a manual similarity-search test |
| 3–4 | Sync product catalog data into the vector store as additional documents with metadata | Product Q&A grounded in real catalog data |
| 5–6 | Implement `/assistant/chat` endpoint with `QuestionAnswerAdvisor`, verify answers cite retrieved context and refuse unknown questions | RAG loop works end-to-end, no hallucinated policy answers |
| 7 | Add `ChatMemoryAdvisor` with session-based memory (Redis or in-memory), test multi-turn conversations | Assistant remembers earlier turns in the same session |
| 8–9 | Implement `OrderLookupTool` and `StockCheckTool`, wire into ChatClient, test tool-triggering prompts | "Where's my order?" correctly triggers a real DB lookup, not a guess |
| 10 | Convert endpoint to SSE streaming | Response streams token-by-token in a simple test client (curl/Postman) |
| 11 | Add guardrails: system prompt scoping, off-topic handling, response length limits | Assistant declines out-of-scope questions gracefully |
| 12 | Add `ai_interaction_logs` (prompt, tokens, latency, sessionId) and an admin log-viewing endpoint | Every interaction is observable/auditable |
| 13 | Testing: mock the ChatModel in unit tests, integration test the retrieval pipeline against a seeded vector store | Tests don't require live API calls to pass |
| 14 | Dockerize (app + Postgres/pgvector + Redis), document required env vars (API keys) | `docker compose up` runs the assistant end-to-end |
| 15 | README: architecture diagram, example conversation transcript, cost/latency notes, "known limitations" section | Repo is interview-ready |

---

## 8. Definition of Done

- [ ] Answers to policy/FAQ questions are grounded in retrieved document chunks, not model memory alone
- [ ] The assistant correctly declines to answer when retrieval finds nothing relevant
- [ ] At least 2 real backend tools are callable by the model and demonstrably triggered by natural language
- [ ] Conversation memory persists correctly across multiple turns within one session
- [ ] Responses stream incrementally (not returned as one blocking JSON payload)
- [ ] Every AI interaction is logged with token usage and latency
- [ ] Ingestion is re-runnable without a redeploy
- [ ] Tests pass without requiring a live model API call (mock the `ChatModel`)
- [ ] `docker compose up` runs the full stack from a clean clone

---

## 9. Resume Bullet Suggestions

- *"Built a production-style RAG customer support assistant using Spring AI, grounding responses in a pgvector-backed knowledge base of policy documents and live product data."*
- *"Implemented tool-calling so the AI assistant can query real order status and inventory data rather than relying on static context, reducing hallucination risk."*
- *"Designed a session-based conversation memory system and SSE streaming response pipeline for a responsive chat experience."*
- *"Added observability (token usage, latency logging) and guardrails to keep the assistant scoped and auditable."*

---

## 10. Interview Talking Points to Prepare

1. "How do you prevent the model from hallucinating policy answers?" (→ retrieval grounding + explicit "don't know" instruction + no-context fallback)
2. "How do you decide chunk size for the text splitter, and why does it matter?" (→ trade-off between context precision and retrieval recall)
3. "What happens if two tools could both plausibly answer a question — how does the model choose?" (→ describe your tool descriptions and how you tested for correct tool selection)
4. "How would you evaluate whether this assistant is actually accurate, not just fluent?" (→ discuss a simple eval set of Q/A pairs you manually checked, even if basic)
5. "How do you control cost at scale?" (→ token logging, response length limits, caching repeated queries)

---

## 11. Stretch Goals (only if time remains)

- Hybrid retrieval (keyword + vector) for better recall on exact SKU/order-number queries
- Re-ranking retrieved chunks before passing to the model
- A small evaluation harness: a fixed set of Q/A pairs with expected answer keywords, run automatically to catch regressions when you change prompts or chunking
