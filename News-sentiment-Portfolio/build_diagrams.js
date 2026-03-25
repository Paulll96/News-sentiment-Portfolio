const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const outputDir = path.join(__dirname, 'presentation_assets');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Mermaid Mappings
const theMermaids = {
    'system_architecture.mmd': `flowchart TD
    A[React Web Client] -->|HTTP POST JSON| B(Express API Gateway)
    C[Node-Cron Scheduler] -->|Time Trigger| D(News Scraper Service)
    B -->|Validated Request| E(Portfolio Service)
    D -->|Raw RSS Text| F(Sentiment Service)
    G[Hugging Face FinBERT API]
    F -->|POST 512-Token String| G
    G -->|Probability Weights| F
    F -->|WSS Score| E
    E -->|SQL Transactions| H[(PostgreSQL Database)]
    D -->|Insert Articles| H`,

    'application_architecture.mmd': `flowchart TD
    classDef ui fill:#4a5568,stroke:#2d3748,color:#fff
    classDef gateway fill:#805ad5,stroke:#553c9a,color:#fff
    classDef security fill:#e53e3e,stroke:#9b2c2c,color:#fff
    classDef ingest fill:#3182ce,stroke:#2b6cb0,color:#fff
    classDef nlp fill:#38a169,stroke:#276749,color:#fff
    classDef db fill:#edf2f7,stroke:#a0aec0,color:#1a202c
    subgraph Client Interface Module
        CP[1. Credentials]
        LP([Login Page]):::ui
        DB([Dashboard]):::ui
    end
    subgraph API Gateway Module
        ER[Express Router]:::gateway
        RH[Response Handler]:::gateway
    end
    subgraph Security Module
        JWT[JWT Validator]:::security
    end
    subgraph Data Ingestion Module
        NS[News Scraper Engine]:::ingest
        HC[HTTP Client]:::ingest
    end
    subgraph Preprocessing Module
        HS[HTML Sanitizer]:::nlp
        SE[Stock Entity Detector]:::nlp
    end
    subgraph Sentiment Intelligence Module
        FB[FinBERT Model]:::security
        TD[Time-Decay Engine]:::security
    end
    subgraph Portfolio Quant Module
        AA[60/40 Allocator]:::nlp
        RL[Rebalance Logic]:::nlp
    end
    subgraph Trade Execution Module
        OG[Order Generator]:::gateway
        TL[Transaction Logger]:::gateway
    end
    subgraph Persistence Module
        DB_SQL[(PostgreSQL Database)]:::db
    end
    CP -->|1. Submit| LP
    LP -->|2. POST| ER
    ER -->|3. Verify| JWT
    JWT -->|4. Issue Token| LP
    NS -->|5. Cron Trigger| HC
    HC -->|6. Raw HTML| HS
    HS -->|7. Clean Text| SE
    SE -->|8. Parsed Target| FB
    FB -->|9. AI Score| TD
    TD -->|10. Save WSS| DB_SQL
    DB -->|11. Trigger Rebalance| ER
    ER -->|12. Auth Check| JWT
    JWT -->|13. Fetch Sentiment| AA
    AA -->|14. Target Weight| RL
    RL -->|15. Buying Signs| OG
    OG -->|16. Commit Log| TL
    TL -->|17. Save Trade| DB_SQL
    DB_SQL -->|18. Return State| RH
    RH -->|19. Updated View| DB`,

    'er_diagram.mmd': `erDiagram
    USERS ||--o{ PORTFOLIO_HOLDINGS : "has"
    USERS ||--o{ TRANSACTIONS : "executes"
    STOCKS ||--o{ PORTFOLIO_HOLDINGS : "tracked in"
    STOCKS ||--o{ TRANSACTIONS : "traded as"
    STOCKS ||--o{ SENTIMENT_SCORES : "analyzed for"
    NEWS_ARTICLES ||--o{ SENTIMENT_SCORES : "generates"
    USERS {
        uuid id PK
        varchar email
    }
    STOCKS {
        uuid id PK
        varchar symbol
    }
    PORTFOLIO_HOLDINGS {
        uuid user_id FK
        uuid stock_id FK
        decimal shares
    }
    TRANSACTIONS {
        uuid stock_id FK
        varchar type
        decimal shares
    }`,

    'usecase_auth.mmd': `sequenceDiagram
    participant Postman
    participant ExpressRouter
    participant AuthMiddleware
    participant PostgresDB
    Postman->>ExpressRouter: POST /api/auth/login
    ExpressRouter->>PostgresDB: "Validate bcrypt hash"
    PostgresDB-->>ExpressRouter: "Match OK"
    ExpressRouter-->>Postman: "200 OK [Bearer JWT]"
    Postman->>ExpressRouter: "POST /api/portfolio/rebalance (Header: Bearer)"
    ExpressRouter->>AuthMiddleware: "verifyToken(JWT)"
    AuthMiddleware-->>ExpressRouter: "User UUID Validated"
    ExpressRouter->>PostgresDB: "BEGIN, UPDATE, COMMIT"
    ExpressRouter-->>Postman: "200 OK [JSON Trade Array Output]"`,

    'usecase_portfolio.mmd': `sequenceDiagram
    actor End_User
    participant App_Component
    participant API_Gateway
    participant Portfolio_Router
    End_User->>App_Component: "Uploads Holdings CSV"
    App_Component->>App_Component: "parseHoldingsCsv() (Sanitize)"
    App_Component->>API_Gateway: "POST /api/portfolio/import [JSON]"
    API_Gateway->>API_Gateway: "Rate Limit & Validate JWT"
    API_Gateway->>Portfolio_Router: "Route sanitized request"
    Portfolio_Router-->>App_Component: "200 OK {imported, rejected}"
    App_Component-->>End_User: "Render updated Portfolio DOM"`,

    'usecase_sentiment.mmd': `flowchart TD
    A[Raw Unstructured RSS Text] --> B{Regex: detectStockMentions}
    B -->|Matches $RELIANCE.NS| C[Associate Article with Stock ID]
    B -->|No Match| D[Discard Article]
    C --> E[Sanitize Text String]
    E --> F[Encode 512-Token Payload]
    F --> G[POST /models/finbert]`,

    'usecase_news.mmd': `sequenceDiagram
    participant CronJob
    participant Scraper
    participant ExternalAPI
    loop Every 2 Hours
        CronJob->>Scraper: Trigger scrape()
        Scraper->>ExternalAPI: HTTP GET (Custom User-Agent)
        ExternalAPI-->>Scraper: XML / JSON Payload
        Scraper->>Scraper: parseArticles()
        Scraper->>Database: INSERT INTO news_articles
    end`,

    'usecase_backtest.mmd': `sequenceDiagram
    participant Controller
    participant QuantEngine
    participant Database
    Controller->>QuantEngine: calculateTargetWeights(holdings, sentiment)
    QuantEngine->>QuantEngine: Apply 60/40 blended formula calculation
    QuantEngine-->>Controller: Return [Target Weight Arrays]
    loop For Each Holding
        Controller->>Controller: abs(Target - Current)
        alt absolute_drift >= Threshold
            Controller->>Controller: push trade into Array
        else absolute_drift < Threshold
            Controller->>Controller: skip calculation
        end
    end
    Controller->>Database: executeTradeQueue(Active Array)`,

    'gantt_chart.mmd': `gantt
    title SentinelQuant 12-Week Development Schedule
    dateFormat  YYYY-MM-DD
    section Phase A
    Research NLP Models           :done,    des1, 2026-01-01, 14d
    section Phase B
    Database & Gateways           :active,  des2, 2026-01-15, 14d
    section Phase C
    Cron Ingest Engines           :         des3, 2026-01-29, 14d
    section Phase D
    Quant Execution Math          :         des4, 2026-02-12, 14d
    section Phase E
    Client Dashboard UI           :         des5, 2026-02-26, 14d
    section Phase F
    Validation & Load Testing     :         des6, 2026-03-12, 14d`
};

// Write MMD files and compile to PNG
console.log('Generating Mermaid PNGs (this may take a moment)...');
for (const [filename, content] of Object.entries(theMermaids)) {
    const filePath = path.join(outputDir, filename);
    const outPng = path.join(outputDir, filename.replace('.mmd', '.png'));
    fs.writeFileSync(filePath, content);
    try {
        console.log("Rendering " + outPng + "...");
        execSync("npx -y @mermaid-js/mermaid-cli -i " + filePath + " -o " + outPng + " -s 2 -b white", { stdio: 'inherit' });
    } catch (e) {
        console.error("Failed to render " + filename, e.message);
    }
}
console.log('✅ Standard Diagram generation complete!');
