# SentinelQuant Academic Defense: Comprehensive Speaker Notes

> **Purpose of this document:** This is your "Cheat Sheet" for the academic defense. Do not put this on the screen. Print it out or keep it on a separate screen to read from and use when answering aggressive technical questions from the panel.

---

## Slide 1: Project Front Page
**What to say:**
Introduce yourselves professionally. State that the project is "SentinelQuant: An algorithmic approach to quantitative finance utilizing Natural Language Processing (NLP) to dynamically balance simulated portfolios natively within a React/Node environment."

**Anticipated Questions:**
*   **Q: Why 'Simulated'?** 
    **A:** SEC/SEBI regulations strictly forbid unlicensed software from executing automated trades with real money. A simulated paper-trading environment is the only legally compliant way to prove the algorithms work in an academic setting.

---

## Slide 2: Introduction
**What to say:**
Most retail platforms only show stock charts (technical analysis). Our system ingest news text (fundamental sentiment) and turns human fear/greed into a clean math variable that a machine can execute traits upon.

**Anticipated Questions:**
*   **Q: How do you get the 'Probability Weights'?**
    **A:** We do not parse words manually. We transmit raw headlines to a specialized neural network (`ProsusAI/finbert`) hosted on Hugging Face. The model responds with JSON data declaring exact mathematical probability floats (e.g., 90% positive, 5% negative, 5% neutral).

---

## Slide 3: Problem Statement
**What to say:**
Retail traders lose because humans cannot read 10,000 news articles a day, and humans hesitate when making trades out of fear. SentinelQuant solves the volume and emotional delay problems logically.

**Anticipated Questions:**
*   **Q: There are existing bots that trade. How is this different?**
    **A:** Existing bots rely predominantly on "Moving Averages" or "RSI". Ours relies on external linguistic sentiment metrics that usually require enterprise Bloomberg Terminals to accomplish.

---

## Slide 4: Project Objectives
**What to say:**
We wanted to prove we could orchestrate decoupled technologies. A Node background worker fetching XML, an external PyTorch NLP model via HTTP, and a PostgreSQL persistence layer protecting ACID transactions all running in sync.

---

## Slide 5: Purpose and Need of the Project
**What to say:**
We needed to prove that modern Web Web APIs (Express/Node) can successfully maintain state and trigger asynchronous algorithmic logic against external Machine Learning boundaries reliably. 

**Anticipated Questions:**
*   **Q: Why not build the NLP model locally in Python instead of Web Tech?**
    **A:** Building monolithic desktop applications limits accessibility. Deploying a headless Node.js gateway interacting with a React Single-Page-Application demonstrates modern enterprise cloud architectures (Microservices). 

---

## Slide 6: Scope of the Project
**What to say:**
The system is scoped perfectly to ingest domestic NSE news, map it to our SQL database, run the FinBERT math, and execute portfolio fractioning math. Live broker APIs are explicitly out of scope for safety and cost reasons.

---

## Slide 7: Social Relevance & SDGs
**What to say:**
Algorithmic logic removes retail speculation. By democratizing quantitative technology via standard browsers, we align with SDG 8, improving equitable economic frameworks against human bias execution models.

---

## Slide 8 & 8.1 & 8.2: Software Requirements
**What to say:**
Emphasize the Architecture constraint table.
*   **Auth (FR-01):** We built native JWT signing, avoiding heavy third-party systems like Firebase or Auth0 to demonstrate core protocol understanding.
*   **Database (NFR-C):** PostgreSQL is mandatory here. NoSQL (like MongoDB) cannot guarantee financial ledger boundaries reliably under heavy traffic.

**Anticipated Questions:**
*   **Q: Why didn't you use MongoDB? It’s easier for Node.**
    **A:** Mongoose/MongoDB suffers from "Eventual Consistency," which is lethal for financial ledgers. We must use standard RDBMS schemas to absolutely ensure `INSERT` statements track ledger trades without race conditions.

---

## Slide 9 & 10: System/Application Architectures
**What to say:**
We employed a 9-module decomposition strategy limiting tight integration variables. The `Data Ingestion` namespace has zero awareness of the `Presentation Layer`. They communicate exclusively utilizing asynchronous JSON parsing through our Express REST endpoints safely.

**Anticipated Questions:**
*   **Q: What happens if Hugging Face goes down?**
    **A:** Because the modules are decoupled, the React UI will remain fully online to view the Dashboard. The Node Cron service simply caches pending news articles until the ML endpoint successfully returns variable arrays.

---

## Slide 11: GUI Design
**What to say:**
We avoided heavy monolithic State Managers (like Redux) in favor of localized React functional component state updates for Recharts SVG generation. It's fast and modular.

---

## Slide 12: API Design 
**What to say:**
We use stateless JSON Web Tokens sent via `Authorization: Bearer <token>` Headers. This protects the server from storing session cookies in memory, which scales better.

**Anticipated Questions:**
*   **Q: Is Bcrypt safe enough?**
    **A:** Yes, Bcrypt relies on a configured "Salt Round" delay executing CPU-heavy hash calculations preventing GPU rainbow-table dictionary attacks natively.

---

## Slide 13: Database Design (ERD)
**What to say:**
Our normalized design binds `Transactions` strictly targeting explicit foreign keys bounding against specific `Users` and `Stocks` protecting data integrity organically natively avoiding unreferenced records mathematically.

---

## Slide 14: Technology Stack
**What to say:**
*   React builds the Single Page Application.
*   Node.js acts as the async, non-blocking I/O Gateway.
*   Postgres offers rigid transaction support natively.

---

## Slides 15-19: Specific Module Use Cases
**What to say:**
*   **(Slide 16 - Cron):** Explain that `node-cron` is vital. A browser should never trigger a scrape. The server triggers it independently every 2 hours without human intervention reliably natively.
*   **(Slide 18 - Quant Execution):** A loop processes an array. It isolates `Current %` and compares it to the FinBERT `Target %`. The discrepancy triggers a strict `Math.abs()` function yielding an Order variable securely natively.
*   **(Slide 19 - ACID DB Persistence):** We use explicit SQL `BEGIN;` and `COMMIT;` boundaries natively. If an error is thrown on line 5, the execution evaluates `ROLLBACK;`, safely reverting partial ledger mutations reliably.

---

## Slides 20-24: The Algorithms
**What to say:**
*(If the panel attacks the math, fall back on these points)*
1.  **FinBERT Math (S20):** It's not just positive or negative. FinBERT gives probabilities. We scale the WSS score heavily discounting "Neutral" probability outputs natively.
2.  **Time Decay (S21):** News ages rapidly. An exponential math curve destroys the score significance of an article that is 4 days old, preserving only immediate reactive momentum signals logically.
3.  **Threshold Bounds (S24):** If a sentiment update changes the target structure by only 1%, the algorithm **skips the trade**. Constant rebalancing destroys capital via execution fees. Our 5% limit logic acts as a friction buffer securely.

---

## Slide 25: Procedure - Entity Fallback
**What to say:**
Most news doesn't say "Reliance Industries Limited ticker symbol RELIANCE.NS". They just say "Nifty". Our RegEx parser runs a fallback query dynamically matching macroeconomic context against the user's specific exchange target definitions flexibly.

---

## Slide 26 & 27 & 28 & 29: Validation & Testing
**What to say:**
*   We mocked algorithms directly verifying expected outputs mathematically.
*   We used **Postman** natively routing HTTP headers verifying the specific Bcrypt JWT generation routes.
*   UI flows evaluate empty states loading accurately vs populated CSV matrices rendering Recharts models logically correctly.

**Anticipated Questions:**
*   **Q: Why don't you have automated Selenium or Cypress E2E pipelines?**
    **A:** Given the academic scope constraints logically natively evaluating structural architectural pipelines via Postman integration boundaries proved significantly more valuable fundamentally than orchestrating extensive DOM navigation bots reliably natively.

---

## Slide 30: Load Evaluation Constraints
**What to say:**
We must prevent our Node application from crashing when external APIs fail dynamically. To combat `HTTP 503` timeouts, we programmed a `setTimeout` recursive execution logic dynamically attempting to reconnect after 15-second padding buffers, which protects the single-thread Event Loop from halting fundamentally.

**Anticipated Questions:**
*   **Q: What is a Node Event Loop?**
    **A:** Node executes JavaScript via a single thread natively. Instead of blocking the whole server waiting on an API, Node offloads the wait to the system kernel (libuv) and continues serving React users uninterrupted logically natively until the response resolves asynchronously.

---

## Slide 31: Bug Resolution Log
**What to say:**
The hardest part was discovering that rendering an SVG Pie chart dynamically natively mathematically crashes when a target allocation drops to precisely `0%`. We resolved this injecting microscopic float variables `0.01` keeping the DOM visually empty but structurally sound logically natively.

---

## Slide 32: Deployment Architecture
**What to say:**
*   We decoupled Vercel for the static React CDN.
*   We use Render for Node Container logic natively seamlessly executing against isolated PostgreSQL layers reliably organically limiting scaling friction securely.

---

## Slides 33-38: Conclusion & Demos
**What to say:**
End by confidently demonstrating the deterministic workflow dynamically generating API output structures objectively securely natively avoiding subjective assumptions radically fundamentally. 
