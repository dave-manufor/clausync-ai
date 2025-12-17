# **System Architecture & Design Document (SADD)**

Version: 3.0.0 (Final Complete)

Status: Ready for Engineering

Cloud Standard: Google Cloud Platform (GCP)

Compliance Target: SOC 2 Type II, GDPR

---

## **1\. High-Level Architecture**

The system follows a **Cloud-Native, Event-Driven Microservices Architecture**. It decouples synchronous user interactions (API) from asynchronous heavy compute tasks (Scraping/AI) using a centralized Event Bus.

### **1.1 System Context Diagram**

This diagram illustrates the high-level interaction between actors, the core system, and external services.

![][image1]

Code snippet

*graph TD*

    *%% Actors*

    *User((User/General Counsel))*

    *Admin((System Admin))*

    *%% External Systems*

    *Ext\_VendorWeb\[External Vendor Websites\]*

    *Ext\_Proxy\[Bright Data/Oxylabs Proxy\]*

    *Ext\_Vertex\[GCP Vertex AI\]*

    *Ext\_Stripe\[Stripe Payments\]*

    *%% The Core System*

    *subgraph "LegalWatch AI (GCP)"*

        *LB\[Global Load Balancer\]*

        *WAF\[Cloud Armor WAF\]*

        

        *subgraph "Compute Layer"*

            *API\[API Gateway Service\<br/\>Node.js\]*

            *Scraper\[Ingestion Worker\<br/\>Python\]*

            *Analyzer\[Analysis Worker\<br/\>Python\]*

        *end*

        *subgraph "Data & Event Layer"*

            *PubSub\[Cloud Pub/Sub\<br/\>Event Bus\]*

            *DB\[(Cloud SQL\<br/\>PostgreSQL \+ Vector)\]*

            *Cache\[(Cloud Memorystore\<br/\>Redis)\]*

            *Storage\[(Cloud Storage\<br/\>WORM Buckets)\]*

        *end*

    *end*

    *%% Flows*

    *User \--\>|HTTPS/TLS 1.3| LB*

    *LB \--\> WAF \--\> API*

    *API \--\>|Auth Check| DB*

    *API \--\>|Dispatch Job| PubSub*

    

    *PubSub \--\>|Trigger| Scraper*

    *Scraper \--\>|Route Traffic| Ext\_Proxy*

    *Ext\_Proxy \--\>|Fetch HTML| Ext\_VendorWeb*

    

    *Scraper \--\>|Save Raw HTML| Storage*

    *Scraper \--\>|Change Detected| PubSub*

    

    *PubSub \--\>|Trigger| Analyzer*

    *Analyzer \--\>|RAG/Summary| Ext\_Vertex*

    *Analyzer \--\>|Fetch Context| DB*

    *Analyzer \--\>|Save Insight| DB*

---

## **2\. End-to-End Data Flow**

This section tracks the lifecycle of a single "Monitor Request" from user input to alert generation.

### **2.1 Data Flow Diagram**

![][image2]  
Code snippet

*sequenceDiagram*

    *participant U as User (Dashboard)*

    *participant API as API Service (Node.js)*

    *participant DB as Cloud SQL (Postgres)*

    *participant PS as Pub/Sub*

    *participant SW as Scraper Worker (Python)*

    *participant GCS as Google Cloud Storage*

    *participant AW as Analysis Worker (Python)*

    *participant AI as Vertex AI (Gemini)*

    *Note over U, API: Phase 1: Subscription*

    *U-\>\>API: POST /monitors (URL: aws.com)*

    *API-\>\>DB: Check if URL exists (Deduplication)*

    *alt URL is New*

        *API-\>\>DB: Insert new Resource record*

        *API-\>\>PS: Publish cmd.scrape\_url*

    *else URL Exists*

        *API-\>\>DB: Link User to existing Resource*

    *end*

    *API--\>\>U: 201 Created*

    *Note over PS, SW: Phase 2: Ingestion*

    *PS-\>\>SW: Consume cmd.scrape\_url*

    *SW-\>\>SW: Check Redis Lock (Debounce)*

    *SW-\>\>SW: Fetch HTML via Proxy*

    *SW-\>\>GCS: Save Raw HTML (WORM locked)*

    *SW-\>\>SW: Compute SHA-256 Hash*

    

    *alt Hash \!= Last\_Known\_Hash*

        *SW-\>\>DB: Update Current Hash & Timestamp*

        *SW-\>\>PS: Publish event.change\_detected*

    *else No Change*

        *SW-\>\>DB: Update Last\_Checked only*

    *end*

    *Note over PS, AW: Phase 3: Intelligence*

    *PS-\>\>AW: Consume event.change\_detected*

    *AW-\>\>DB: Fetch Previous & New Snapshot Paths*

    *AW-\>\>GCS: Download HTML contents*

    *AW-\>\>AW: Generate Markdown Diff*

    *AW-\>\>AI: Prompt: "Analyze Risk" (Tier 1\)*

    *AI--\>\>AW: JSON Risk Assessment*

    

    *loop For each Subscriber with RAG enabled*

        *AW-\>\>DB: Vector Search (User Policy vs Diff)*

        *AW-\>\>AI: Prompt: "Does this conflict?" (Tier 2\)*

        *AI--\>\>AW: Personalized Impact*

    *end*

    

    *AW-\>\>DB: Store Alert Record*

    *AW-\>\>API: Webhook / Email Trigger*

---

## **3\. Technology Stack & Rationalization**

| Layer | Technology | Rationalization |
| :---- | :---- | :---- |
| **Edge** | **Cloud Load Balancing \+ Cloud Armor** | Provides global anycast IP for low latency and **WAF** protection against DDoS and SQL injection attacks. |
| **API** | **Node.js (Express)** | High concurrency for I/O-bound REST endpoints.  |
| **Compute** | **GCP Cloud Run** | Serverless containers scale to zero (cost) and burst to 1,000+ instances (scale). Supports running headless browsers natively (unlike AWS Lambda). |
| **Storage** | **Cloud SQL (PostgreSQL 16\)** | **Converged Database:** Handles relational data (Users), JSON (Diffs), and Vectors (pgvector) in one ACID-compliant engine. |
| **Evidence** | **Google Cloud Storage (GCS)** | Configured with **Object Versioning** and **Bucket Lock** (Retention Policy) to serve as a legal "Digital Notary." |
| **Queuing** | **Cloud Pub/Sub** | Global, asynchronous messaging. Decouples the fast API from slow Scrapers. Guarantees "At-Least-Once" delivery. |
| **Security** | **GCP Identity Platform** | Managed Authentication (OIDC/SAML). Offloads risk of handling password hashes. Supports Enterprise SSO (Okta/AD). |
| **AI** | **Vertex AI (Gemini 1.5 Pro)** | **1M+ Token Context Window** allows the system to analyze entire contracts without complex chunking, increasing accuracy. |

---

## **4\. Detailed Component Design**

This section details the internal logic, interfaces, and configurations for **all** system components.

### **4.1 Edge Layer: Cloud Load Balancer & WAF**

* **Role:** The Shield. Protects the origin API from malicious traffic.  
* **Configuration:**  
  * **Protocol:** HTTPS only (TLS 1.3).  
  * **Cloud Armor Policies:**  
    * **Rate Limit:** Block IPs exceeding 500 requests/minute.  
    * **OWASP Top 10:** Enable pre-configured rules for SQLi and XSS protection.  
    * **Geo-Blocking:** Deny traffic from sanctioned regions (OFAC compliance).

  ### **4.2 API Gateway Service (Node.js)**

* **Role:** The Entry Point. Orchestrates user requests and manages subscriptions.  
* **Framework:** ExpressJS (TypeScript).  
* **Key Responsibilities:**  
  * **Auth Middleware:** Validates JWT tokens from Identity Platform. Decodes uid and injects it into the Request context.  
  * **Validation**  
  * **Business Logic:**  
    * POST /monitors: Normalizes URLs (strips utm\_params). Checks monitored\_resources to see if the URL is already tracked. If not, creates it and publishes to cmd.scrape\_url.  
* **Interfaces:**  
  * REST API (Internal & Public).  
  * Pub/Sub Publisher (Google Cloud Client Library).

  ### **4.3 Ingestion Worker (Python Scraper)**

* **Role:** The Hunter. Fetches data from the hostile web.  
* **Framework:** Python 3.11, Playwright, BeautifulSoup4.  
* **Isolation:** Runs in a **Sandboxed Container** (gVisor enabled on Cloud Run) to mitigate Remote Code Execution (RCE) risks from malicious JS.  
* **Logic:**  
  1. **Consume Message:** Pulls cmd.scrape\_url.  
  2. **Singleton Lock:** Checks Redis SETNX lock:scrape:{url\_hash} with 5-minute TTL. If locked, Ack message and exit (deduplication).  
  3. **Fetch:** Launches Headless Chromium via Playwright. Uses **Stealth Plugin** to mask WebDriver signals. Rotates Residential Proxies via Bright Data if 403/429 received.  
  4. **Process:** Extracts text, converts to Markdown. Computes SHA-256 hash.  
  5. **Compare:** If hash \!= current\_db\_hash:  
     * Upload HTML to GCS.  
     * Update DB.  
     * Publish event.change\_detected.

  ### **4.4 Analysis Worker (Python AI)**

* **Role:** The Brain. Interprets changes and generates alerts.  
* **Framework:** Python 3.11, LangChain, Vertex AI SDK.  
* **Logic:**  
  1. **Tier 1 (Global):**  
     * Fetches Old and New text from GCS.  
     * Computes Semantic Diff (Python difflib).  
     * Calls Gemini 1.5 Pro: *"Summarize the legal impact of these changes."*  
     * Saves Global Summary to change\_events.  
  2. **Tier 2 (RAG/Personalized):**  
     * Queries subscriptions for users tracking this resource with personalization=true.  
     * **Vector Search:** For each user, queries user\_context\_embeddings for policies relevant to the changed clauses.  
     * **Conflict Check:** Calls Gemini: *"The vendor changed X. User Policy says Y. Is there a conflict?"*  
     * Inserts results into notifications table.

  ### **4.5 Event Bus (Cloud Pub/Sub)**

* **Role:** The Nervous System.  
* **Topic Topology:**  
  * cmd.scrape\_url: Trigger scraping. (Subscribers: Ingestion Worker).  
  * event.change\_detected: Trigger analysis. (Subscribers: Analysis Worker).  
  * cmd.vectorize\_doc: Trigger embedding generation. (Subscribers: Analysis Worker).  
* **Reliability:**  
  * **Dead Letter Queues (DLQ):** After 5 failed delivery attempts (e.g., worker crash), move message to dlq.scrape\_failed for manual inspection.

  ### **4.6 Persistence Layer (Cloud SQL)**

* **Role:** The Memory.  
* **Engine:** PostgreSQL 16\.  
* **Extensions:** pgvector (Vector Search), pg\_trgm (Text Search).  
* **Key Schemas:**  
  * **monitored\_resources**: Uniqueness constraint on (url, selector).  
  * **user\_context\_embeddings**: Partitioned by user\_id for performance and isolation.  
  * **audit\_logs**: Append-only table recording all system mutations.

  ### **4.7 Caching Layer (Cloud Memorystore Redis)**

* **Role:** The Accelerator & Coordinator.  
* **Usage:**  
  * **Distributed Locks:** lock:scrape:{url\_hash} ensures we don't scrape the same URL 50 times in parallel.  
  * **Rate Limiting:** ratelimit:{user\_ip} for the API Gateway.  
  * **Session Cache:** Stores temporary user session data (if needed).

  ### **4.8 Object Storage (Cloud Storage)**

* **Role:** The Evidence Locker.  
* **Bucket Structure:** gs://legalwatch-snapshots/{year}/{month}/{day}/{resource\_id}\_{hash}.html  
* **Compliance Config:**  
  * **Bucket Lock:** Enabled. Retention Policy \= 7 Years.  
  * **Versioning:** Enabled.  
  * **Public Access:** Prevention Enforced (IAM Only).

  ---

  ## **5\. Security Architecture (The CIA Triad)**

This system is designed to meet **SOC 2 Type II** and **GDPR** standards.

### **5.1 Confidentiality (Encryption & Access)**

* **Data-in-Transit:** TLS 1.3 mandated for all connections (External and Internal Service-to-Service).  
* **Data-at-Rest:**  
  * **DB:** Cloud SQL encrypted with **Customer-Managed Encryption Keys (CMEK)** via Cloud KMS.  
  * **Storage:** GCS buckets encrypted by default.  
* **Secrets Management:** API Keys (Stripe, OpenAI, Proxy) stored in **GCP Secret Manager**. Injected into containers at runtime as temp environment variables.  
* **Tenant Isolation:** All SQL queries utilize **Row-Level Security (RLS)** patterns. Every query appends WHERE user\_id \= :current\_user.  
* **GDPR Compliance:** Users select a "Home Region" (e.g., europe-west1). PII is stored only in that region. "Right to be Forgotten" API triggers hard deletion of user rows.

  ### **5.2 Integrity (Audit & Evidence)**

* **WORM Storage:** Raw HTML snapshots are stored in a GCS Bucket with a **7-Year Retention Policy**. Once written, files cannot be modified or deleted by anyone (including admins), ensuring legal admissibility.  
* **Audit Logging:**  
  * All "Write" actions (Create Monitor, Update Settings) are logged to **Cloud Logging**.  
  * Logs are exported to a separate "Audit Project" for tampering protection.

  ### **5.3 Availability (Resilience)**

* **Database:** Cloud SQL configured in **High Availability (HA)** mode (Primary \+ Standby in different Zones). Auto-failover \< 60s.  
* **Compute:** Cloud Run services deployed across multiple zones.  
* **Disaster Recovery:**  
  * **RPO:** 1 Hour (Point-in-Time Recovery enabled for DB).  
  * **RTO:** 4 Hours (Terraform scripts can rebuild infrastructure in a new region).

  ---

  ## **6\. Deployment & Operations (DevOps)**

  ### **6.1 Infrastructure as Code (IaC)**

* **Tool:** **Terraform**.  
* **Strategy:** The entire infrastructure (VPC, SQL, Cloud Run, Pub/Sub) is defined in .tf files. This ensures the environment is reproducible and prevents "Configuration Drift."

  ### **6.2 CI/CD Pipeline (Cloud Build)**

1. **Commit:** Dev pushes code to GitHub.  
2. **Lint & Test:** Cloud Build runs unit tests and ESLint/Black.  
3. **Security Scan:** Runs trivy container scan to check for CVEs in base images.  
4. **Build:** Builds Docker images; pushes to Artifact Registry.  
5. **Deploy:**  
   * **Staging:** Auto-deploy.  
   * **Production:** Manual approval gate. Deploys using **Traffic Splitting** (Canary Deployment: 10% traffic $\\rightarrow$ New Version).

   ### **6.3 Monitoring & Alerting**

* **Dashboards:** Google Cloud Monitoring.  
* **Key Metrics:**  
  * scraper\_success\_rate: Alert if \< 95%.  
  * pubsub\_oldest\_unacked\_message: Alert if \> 10 minutes (Worker lag).  
  * api\_latency\_p99: Alert if \> 500ms.  
* **Log Sinks:** Error logs streamed to **Error Reporting** for immediate stack trace visibility.

  ### **6.4 Cloud Scheduler (Scheduled Workers)**

Scheduled tasks are handled by dedicated HTTP-triggered workers, invoked by Cloud Scheduler:

| Worker | Schedule | Description |
| :---- | :---- | :---- |
| **monitor-refresh-worker** | `0 * * * *` (hourly) | Claims and refreshes due monitors, publishes scrape commands |
| **billing-lifecycle-worker** | `0 0 * * *` (daily) | Handles trial notifications, expirations, subscription cleanup |
| **cleanup-worker** | `0 2 * * *` (2am daily) | GDPR/SOC2 compliant hard deletions and GCS cleanup |

**Cloud Scheduler Setup:**
```bash
# Monitor Refresh (hourly)
gcloud scheduler jobs create http monitor-refresh \
  --schedule="0 * * * *" \
  --uri="https://monitor-refresh-worker.run.app/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=YOUR_SECRET"

# Billing Lifecycle (daily at midnight)
gcloud scheduler jobs create http billing-lifecycle \
  --schedule="0 0 * * *" \
  --uri="https://billing-lifecycle-worker.run.app/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=YOUR_SECRET"

# Cleanup Worker (daily at 2am)
gcloud scheduler jobs create http cleanup \
  --schedule="0 2 * * *" \
  --uri="https://cleanup-worker.run.app/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=YOUR_SECRET"
```

**Authentication:** All workers validate the `X-Cron-Secret` header before processing. In production, use GCP Service Account authentication instead.

## **7\. Financial & Cost Optimization Strategy**

This architecture is explicitly designed to support the **Lean MVP** financial model while scaling to Enterprise.

1. **Inverse Cost Curve (Singleton Pattern):**  
   * By monitoring the *Resource* and not the *User*, we achieve economies of scale.  
   * *Example:* 10,000 users tracking openai.com/terms results in **1 Scrape Job**.  
   * *Impact:* Variable costs ($C\_{resource}$) remain flat while Revenue ($R\_{user}$) scales linearly.  
2. **Serverless Scale-to-Zero:**  
   * **Cloud Run** instances spin down to 0 when no jobs are in the queue. You do not pay for idle servers (unlike AWS EC2/Fargate).  
3. **Converged Database:**  
   * Using **Cloud SQL** for *both* Relational and Vector data eliminates the \~$70-100/mo cost of a dedicated Vector Database (e.g., Pinecone), significantly lowering the break-even point.

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnAAAAHxCAYAAADtF4FDAABIs0lEQVR4Xu3d95scxdnv//NXPN/fj68jLHIG2SAJiZyDBeIhymCiyckYjMkZg8FkI3I0wYAxGZHBmGSCJIJAEQnFVdaudna+ql5XU13dPVs1MzV1z8z7dV331d3VYWbv+ezqPuvnsP+nCgAAgLbyf+wFAAAAyFbXALdmcqU679xesSXVmTO/rG78xaS2rKX9a+0vR7S1N27fllWv//v5YpElzW7fXdixFcPD1/S1dTXDmtNO6/hqV30f/k9b1MCS5+237qSuAa6yQnb1PC1z2Oip9LV1tYuBKc9Vq6sXtWXVM8QdMG1ZdeFAVWRJGuLUkNOz7gdEp1arqQFo5fJqW9cj1zb2c63/jTeqA8uWdXy14xCXDEb989qm6tGRA5z6LVxPT4/9tqMaOeXtqj0QtV0J62mpgsGoXaryycPefVZDkj04SSn13ny/nlA6fYBrdZ87YYBT1Ujf1GBjDzudWAxw4aueHDLAtQgDXAsVDEbtUgxw4XTDANfX19hvlHwwwHXXANdIn2JggCtRKRiaJBUDXKAS1tNSBYNRuxQDXDgMcM3FAMcAJxkDXIlKwdAkqRjgApWwnpYqGIzapRjgwmGAay4GOAY4yRjgSlQKhiZJxQAXqIT1tFTBYNQuxQAXDgNcczHAMcBJxgBXomINTNtsuUdurazUtRf+/rrcuqqf/7/tc2tDlbpnw+GjM2vtMMCp9622W2+5e1J6X5+/4ea702vqLXW/+Uzfyr2+sJ6WMgYi9TVsvsnOydYelsw6+siTM/eo7ZmnnJe7zqxtttwtt+Zyrla1YoDbet33oL1m1i67HJJsVR/MdfvYpSQPcIP5LhiE6qjB77Ps2ulnXZRbs2uTDccW3lu0Zlfu/Uce4NT7sYcj11L3nnHqpV7P0NduvcUeuXM+1Ug+7QFOvSd7+Bnq3FMP/z23ts0Wuxfu+5S6T1VlaX5dbcvej6oRW+2ROW73AU79PDa3vpX06r/3m8/Q63pbVptuNDZzPH7c0bl76ulvUwY49Ubs7W+PPS/Z6jVdi+csLbzPLHPNvq7s+v7lA+lz22GAu/DSGzLH9sB06GEn59bN8/pr1/tffj892Y4/+ITSZ9r3FJ3X2z33PCLznKSE9bSUNRTN+PrL5GtS+7oH+livmQOcWZdfdHVuzb7XfF7RtqjMa46ZcGr6vFYMcKeccUn6PvSaebzxuqHCPGeet9eHKqkDnPo67P1FfUszx/rrNdcOGn9c9Zjjzi48bx+bA5w6XtQ3+I/mzjuNT9a++O7r9PxFl/2pevvdD2SuV/X+fz7JvYfrbrw93c9UxAFOvR+9P3zYyPTY3JrX2MeqPvnom8z1Lz7/bnXM6AOrSxb15l7jn/94K/fa5jP1vqoH73s2c3z+uddmXreRfNoD3Kr5C9LhSJU5KOmtqh223z/znuzzw4f9tK/WP3v/o8Lr9HHfkiWZZy2aMTs9d/xRZ1bvvGli5n0VvXbv4sXVibfcm3u+qnYf4Lbdavdke+Rhx//0dfcPDl72sdpuvcWu1bPOOC+9X68XlXmu6Llre3+ofvnZe+nx1Mkf5J6hqp7+BhvgdOlr1i6rJFs9wM2fuTj5zYj5DPP6orVNN9ox8zo7jxmf7h95yKnpde0wwOmvTe1vsdku6Zp5zZL+3sy6ud1kXS/sAct8Ztma2v/L7feVnle1/nqjqi+/9V7u+dJ6WsoauMqGLvN82QB3z5335Nb0vVtuukvhs83tXrsdUh293b6Zdfsa8/5WDHDq9cytvV5U+n3b60OV1AGuVm227ufSkv7lydf71ezvkzX99asBTl+njseOOTDZzloyL/ccNcCpc+b9+ljVhKNOS7bq+1+9ntpf0v/Ts83X0cOlKjXAmcdpCRjgDhp3QrJ/yPiTqvPnrcwNU+b15rH9HL1vDnBlZd9j7qt/Y3657T7V/133fvSa/bqN5NMe4MyvVa+p9/CnK27KrKmaOeXr6piRB6TH21q/9dp4gzHJPT2zf8jdq1+r7DV3GXNQeq5/3ddXdp8ats11NcAtmD4z91rtPsDZA1fSg5Jzartm1azc+pQv3s9db96j92+/9dbc8/UAZ99rVj39bcoAF7vmfr8gc9wOA1wr6va7H8mt+ZQKXGZNWE9LWQNXI6V6YK9VVi7IrdWqomeUVSsGuFp12JGn5dYaqXYc4HQN5j+/3sxavHZZ5tjnNXPXRhzgJJfqk7m1q5F82gOcSyX/kBesN7tWzp+fOb7+ir/krimr/qVLM8edNMA1s4YaymqVfW89/e2IAc4uBrhAJaynpQoGo3ap2ANcs6udB7i2Kwa4uqqRfNYzwLVjMcCFr3r6ywDXIgxwLVQwGLVLMcCFwwDXXAxwDHCSMcCVqBQMTZKKAS5QCetpqYLBqF2KAS4cBrjmYoBjgJOMAa5EpWBoklQMcIFKWE9LFQxG7VIMcOEwwDUXAxwDnGQMcCUqBUOTpGKAC1TCelqqYDBql2KAC4cBrrkY4BjgJGOAK1EpGJok1Y8XyRvglNxA1G4lsKeFCgajdqm1N27v3WcGODcMcM3VCQPca4/1N5TP3osvzg07nVgMcOGrnv7WNcAp6rdczaq5567JrdVbqgm6JNrki0ltWZJ7WmTtjSODVN+6Actea1q9flNDff7ZumFJUkn8Xuzt7U0GuZbUtIK1QBWrz+o11SDXjvX0bYP/j9Jm9E0NOK2q1QVrIatZPYql78P/r6nVu24wtNcarXp7XPcAp5g/oBupYT8bkVtrpJYuXWq/VVHs99suNTAwYH8potnvvxnV7KwWVb3s50gpaez3F6pakRWzYlm+fHnuvbRTNYP9zJDV6lzpalf219Fohep/f3+//daH1NAA1yzJf+gUaANkFa7ICkIgV3FJ6n9rB7iVT1ARSv3fAqA5JH3zQjayghDIVVyS+s8A1wWlBjj1K1o0TtI3L2QjKwiBXMUlqf8McF1QDHDNI+mbF7KRFYRAruKS1H8GuCZX8uF6rLeiGOCaR9I3L2QjKwiBXMUlqf8dN8Cp5v7myMPSfb1VdeQh/5uubbPlTtW9dt03c5+5VTWw4vF0bfGcB9L93595XPpMXebr6P0Nh48qvcZcC10McM2TfGaAA7KCEMhVXJL635ED3Nxp9+TWzAFKbd+ddENS5jX2s8x79QCn1wZWZJ+ra9IL1ybb+dPvS85tuenY3PP1fc8/dWXu9UIUA1zzSPrmhWxkBSGQq7gk9b8jB7iytQ/e+HO6r7YvPXtV5poD9xuXG7TUb+HUdunch5K1MSN3T88d++vDc6/5wZt/TrZqgDOfY76u3r73+k8DZMhigGseSd+8kI2sIARyFZek/nfcAEfliwGueSR980I2soIQyFVckvrPANcFxQDXPJK+eSEbWUEI5CouSf1ngOuCYoBrHknfvJCNrCAEchWXpP63dICz//aXrlB/W4zKFhon6ZsXspEVhECu4pLU/5YOcGUkNQSohazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVuGKrCAEchWXpP4zwAEeyCpckRWEQK7iktT/thjg1HlVb735Qbqv11etWp1ZM+9xNWq7/e2lQrvu9N+/pVr96T35vE49tt5id3sJEYX+vNE5yApCIFdxSep/Wwxwmn3dvHnzM8c2PWCdePzvC9dXr16THG++6c7p+k5jx1eXLV1effmlN6s33TjRvC0zsJUNb/baihUr02tHbL1n9T//mZw5r9bHjh5X3XSjHdN733v3w+qM6bOT/e1+sY95OSKzP1+gDFlBCOQqLkn9b6sBTqlUKpnjonv1mhrw7PPvvftRbvg65uizkq1eUwNcEXVe/7ZOP8N+vm3Sa+9U75n4aLJfdK05hBadL1pDPHwecEVWEAK5iktS/9tugIvJHh5bQf+WEDK0S1YRH1lBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwbYy+tR49hyuyghDIVVyS+i9mgKMaK7QGvYYrsoIQyFVckvovZoCDP/rWevQcrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAAzyQVbgiKwiBXMUlqf8McIAHsgpXZAUhkKu4JPWfAQ7wQFbhiqwgBHIVl6T+M8B1mT12OyzZqr/rWsb+PPSx3i5auDjZqv+wsd53YT+3jHpm2XNdn+Hjjdffs5dKhXh9dCayghDIVVyS+s8A14VUv9UAZw9mv9x272Rf1TZb7p5ev/7PR6Xr5vVTJn+TOTapNfVnxMxzhx1yUrW3ty99lv08e//M0y+qLliwKHOdeZ+i37M+r+y/71GZa/Uz9Hn1tV1w/tXV3jW9uXuH4nodQFYQArmKS1L/GeC6lPkbONX//v7+6iHjT0yPTWqAM+nzaoAbP+64zDnNHJj0Vg1wfX2DA5zJPDb377v3b5nn6PO17lc223indN0+p6j3odbVAKcVXVfE9TqArCAEchWXpP4zwHUZPdTYA5x5TtU3X01LzxcNcKrs38CZn6P5LE0PTvb15jU7jx2frm28wdjq7bfdn3t/77//cW7NZL62Gkz1mnl+q813ywxwxx1zTrpfi/1aQBmyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuyApCIFdxSeo/AxwwBJVPnVGyCldkBSGQq7gk9Z8BDhiCmU+yCldkBSGQq7gk9Z8BDvBAVuGKrCAEchWXpP4zwLW5YcO29y7lP59+aT0pb9q0Gelno7aqZs6ck+7XKn3P8/98Ld13oa9T/5Fg+7Vr1V13PpR5beXWm+9N912Y99vPr1V/OO/q9B4X2261R7qv79n+F/vmnmvXURNOT/f1vYcfenL6LBcHjTs2c7+qQ//3t7nXMl8H9aF/CIFcxSWp/wxwXWjVqlX2EhyRVbgiKwiBXMUlqf8McF2op6fHXuo4f77hr+n+s8+8nGSst3fwv/u2687lf0ZM0XksymXRGlCErCAEchWXpP4zwHWhbh3gNJcBTpf6DwE/8tDfM+cAF2QFIZCruCT1nwGuC3XbAKeHMU0NcEWZ02vmVv3f4mkvvvB64X1AEbKCEMhVXJL6zwDXYexhpUg3DHBD9aBe9pAHlCEjCIFcxSWp/wxwHUb1cvNNds4c27phgAulqJ9AEbKCEMhVXJL6zwDXhRjg6kdW4YqsIARyFZek/jPAdZk77niIAa4BZBWuyApCIFdxSeo/A1yb23rrPapbbbW7U6nBjeGtMWQVrsgKQiBXcUnqPwNcB9CDmUuhMWQVrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAAzyQVbgiKwiBXMUlqf8McIAHsgpXZAUhkKu4JPWfAQ7wQFbhiqwgBHIVl6T+M8ABHsgqXJEVhECu4pLUfwY45EyfPjv9TMztBj8fnWzN0szr7M+zr68v2W65+a7pmn39v//9ae5522y5R3WLzXZJr1m1clXuGr1dsWJlet1K4zp726hmPQedj6wgBHIVl6T+M8AhRw1wf3vs2WTfHIB01WJeY1+rB0Dz3PgDj6u+++5HuWvVsRrglGXLVqRr5nX2exsYGMishxDy2egsZAUhkKu4JPWfAQ4pPQi5DnBFn5t5zddffZe5puw3cDNnzqn29CzNvZYe4PSxGtCKXt98b6oqlUrmOvPaRjXrOeh8ZAUhkKu4JPWfAQ7wQFbhiqwgBHIVl6T+M8ABHsgqXJEVhECu4pLUfwY4YAgqnzqjZBWuyApCIFdxSeo/AxwwBAY41IOsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAgygqC3Ye7r/38cxxvezn1qMZz0B3ICsIgVzFJan/DHAQRWXh0ktuyK319fVlju3M6GN73VTr3E03Tswc62tffOH1ZDt37o/p+sYbjEn2n3v2lcGLgQK18gbUi1zFJan/DHAQxcyC+UfsNxy+Q7quB7hly5Zn1sytTV2r71MWL+5Jtr/YZi/zssTatf3JdU89+Xy6Zg5wuswBbv78hek+oJRlEWgEuYpLUv8Z4IACRZk0B0BgKGQFIZCruCT1nwEO8EBW4YqsIARyFZek/jPAAR46Mavqa5r27XR7GQ3qxKwgPnIVl6T+M8B1ENVHimqk0Dz0EyGQq7gk9Z8BDvDQiVntxK9JAvqKEMhVXJL6zwAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DXJubMuWbdFu2v3r1msy15v6CBYtL75s2bUbm2rJ9+z5zf+nSwf9WW9F96lzZfea+VrSv3mPZfeprM68191VPyu6r9doqq3p/1qwfnO8z9+1rW32ffd7cL7sW/vi5hhDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4NAxVI7KslS0fv11dyTbsTscmGzPP++qZPur/X+TXmMreg5QhKwgBHIVl6T+M8ChY+gBrihPam2vPY5I983tj/MWJNuvv/4u2Q4fNjLZFil6NlCErCAEchWXpP4zwKFjmMOb+r9xm/zlN5lhTR2b9Llnnn4xc6zcfNPd6b6JrMIVWUEI5CouSf1ngENbC5mdomcXrQFFyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVuGKrCAEchWXpP4zwAEeyCpckRWEQK7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DXJcr633Zekhbbb6rvZSj3td2I/axl1smRl/QnsgKQiBXcUnqPwNcl9O9/81RZyXb+T8uTNeLPpcHH3gy3b/04utLr7OZ1+j9EVvvma4p5gCnr5k164dkO2PG7My6sveeRxS+vl674vKbkuNKZSB3Tb2a9Rx0PrKCEMhVXJL6zwDX5fSwowc4c32LzXZJj1995a1kzfxD7+r4l9vunfv8vvziq8yxYl7z44+DfzxeD3B9fX25a+xnanpd3aP2D9j3qGS7du3a9JojDj05/bq0suf5atZz0PnICkIgV3FJ6j8DHETT2ZCSESnvA/KRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAcMwcwnWYUrsoIQyFVckvrPANdBVB+pcHXUkacnW8AFWUEI5CouSf1ngAOGsN8+v073ySpckRWEQK7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DHOCBrMIVWUEI5CouSf1ngAM8kFW4IisIgVzFJan/DHCAB7IKV2QFIZCruCT1nwEO8EBW4YqsIARyFZek/nf1ALfdiH2S1/7Pp1+m78F+LyO32y9zjO5m5wMoQ1YQArmKS1L/u3qAW3+9Ucm27PXL1qdO+dZeyvj6q+/sJXSIskwANrKCEMhVXJL639UDnKZe/4D9jraXq5dfdqO9lKhUKsk9jz7ytH0qoc5tvsnO9jI6QOyson2QFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/xQ1wkpoD2MgnXJEVhECu4pLUfzEDnFnmWtH+7Nlz031N71915c2l9x007tjMtWX79n3m/ttvfZC51tx/9JFnSu/bdqs9Mtea+/a15r59rblfdi3Coc9wRVYQArmKS1L/xQxw2rnnXG6cAWSR9M0L2cgKQiBXcUnqv7gBDpCMrMIVWUEI5CouSf1ngAM8dEpW+z78n2p15RNUhEp6D9SpU34GtStJ/WeAAzx0SlYZ4OKV6n1PT4/9kQBOOuVnULuS1H8GOMBDp2SVAS5eMcChEZ3yM6hdSeo/AxzgoVOyGmOA22/P/asXn//b6hUXn5I7V6uSnhc8y14bqh66+4+5tRjFAIdGdMrPoHYlqf8McICHTslqjAFOD2JqgFP7M6belWz1urndaPiozL1bbrZjZpDT+1ddMvgsNZwVPccuvf7vt27MrLWyGODQiCSziEZS/xngAA+dktVYA5wq/Ru4osHKXNf3Ff22zTyv9scfcOCQz7HvLzsXuhjg0Igkt4hGUv8Z4AAPnZLVGANcyIo1jNVTDHBoRKf8DGpXkvrPAAd46JSsdtoA107FAIdGdMrPoHYlqf8McICHTskqA1y8YoBDIzrlZ1C7ktR/BjjAQ6dklQEuXjHAoRGd8jOoXUnqPwMc4KGTsqqGCCpcDfvZiNyaWUA9OulnUDuS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAAzyQVbgiKwiBXMUlqf8McIAHsjq0gYEBe6mtNOszbtZzABO5iktS/xngAA9k1Z3dq48/+jxds8+pY3tNmTN7brItOqfpc99+8332hEVd99STz9vLCXVu7g8/pvvN0KznACZyFZek/jPAAR7Iqju7V2qA0+v2uaI1Zfr0Wcm26Jzti8+nZo7te9Tx3x57NrOmMcChXZCruCT1nwEO8EBWO0OlUqnOmTM3qVDICkIgV3FJ6j8DHOCBrMIVWUEI5CouSf1ngAM8kFWUsbNhHwPNQK7iktR/BjjAQzdkVX2NVGOl+wg0G7mKS1L/GeAAD2QVZexs2MdAM5CruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2S1fdl/qaER++49Ycgs1Hu+bH0oxx97jr2EDlRvPtAckvrPAAd4IKvtyfzcXp/0bvWIw07JrKvt/fc9nrtW+cU2e1WnTvk2c605wJnXn3HaRel+0Xn72ebx8GEj0zXz3tWr11SnTZueXqfXa23RufiM45LUfwY4wANZbU/252YOSaYff1xgLyX0taefemGyLfsNnB7gip4/Yt0gaLOvMdfmzZ2fHhcNcPq6a666JbOOzsZnHJek/jPAAR7IavsyP7vZswf/Buq+e/862arfymlz5sxL9xV97aknX5Bs77jt/urCBYvT9T+cd3XmWr2uX2/hwsXp+RUrVqb7vz3h98m15trAwOAzzjn70uT4vrsfS8+Z9GucePy5yfY3R51pnkYH42dQXJL6zwAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DHOCBrMKVyspQBfgiN3FJ6j8DHOCBrMKVa1ZcrwMU8hKXpP4zwAEeyCpc+WRlxvRZ9hJQyCdXaD5J/WeAAzyQVbjyzYrv9ehO5CQuSf1ngAM8kFW48smKz7XobmQlLkn9Z4ADPJBVuFJZ0VXLUOcBE3mJS1L/GeAAD2QVrswBrqj22WuCfQswJH4GxSWp/wxwgAeyClc6K7/cdm/rDFA/fgbFJan/DHCAB7IKV2QFIZCruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGswlVZVsrWARfkJy5J/WeAAzyQ1c6kP9clS5ZWn/77i5m1Wp/5tlvvmWxvv/W+ZKuunTdvQbqvmc8atd1+1YGB4vPmvr3W29uXHqN71cojwpPUfwY4wANZ7Uzqc1X16CPPVF956c1kbeXKVdXeNb2567QnHn8uN8C99OIbhQOYabsR+yTb44/9XbqmX1/bfddDM+f09sH7n0jX0Z3KcoXWkNR/BjjAA1ntTPpzvevOh9L9Y39zduacva/oAe6v6+6z2UOZ3tcD3JGHn5oZzmxF92652a7pGrpTUVbQOpL6zwAHeCCrcNXsrEz/fpa9hC7U7FzBj6T+M8ABHsgqXJEVhECu4pLUfwY4wANZhSuVlaEK8EVu4pLUfwY4wANZhSvXrLheByjkJS5J/WeAAzyQVbjyycqY0ePsJaCQT67QfJL6zwAHeCCrcOWbFd/r0Z3ISVyS+s8AB3ggq3Dlk5WHH3rKXgIK+eQKzSep/wxwgAeyClcqK7/a/zdDZmao84CJvMQlqf8McIAHsgpXKitDFeCL3MQlqf8McIAHsgpXOitkBs1EnuKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAAzyQVbgiKwiBXMUlqf8McIAHsgpXZAUhkKu4JPWfAQ7wQFbhql2ysmrVansJgrVLrjqVpP4zwAEeyCpcuWTl3HMuT6977dW30/WVK1el+yZ97auv/HRtpVJJr6/1mrXOKeb5Sn/FODN4Tp8fP+64zDnT66+/m+4vWrjYOFOtrl69JtkO9T5QG/2LS1L/GeAAD2QVrlyzUnSdOTDVWrPXa13T17fWXk6p84cfepK9nDCfN336rOrGG4w1zg6e33KzXauvGUOlvuejjz7LHNv78Ef/4pLUfwY4wANZhSvXrNhDl94vut++dvasucbZ4nuK2Nfp4y023SXZbr7JztUZ02en5+fNW5Dur7/eqHRfsd+TqehrKbsWbuhfXJL6zwAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DHOCBrMIVWfGnenbFZTfayzCQq7gk9Z8BDvBAVuGKrPhTPaNvtdGfuCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGsdhb1d0Sb+Zmaz9L79vPVsX1u7Ohxuevuv/fxzLFmX4fuwucfl6T+M8ABHshqZyn6PM0Ba8WKlZk183r9x9kP2O/oZLvz2PHVP117e+b6MvYAt9OYgzLX17q/bB3dgc8/Lkn9Z4ADPJDVzlL0eZ595iXpeq0B7qup09L9Iua1Bx94vHHGjfoNnP3+7PeA7sPnH5ek/jPAAR7IanfRA1w9yApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyClcqK7pmz56bObfrTv+bngN8kJm4JPWfAQ7wQFbhyjUrxx9zTvWC86+xl4FCrrlCGJL6zwAHeCCrcOWblYl/fdheAnJ8c4XmktR/BjjAA1mFK9+sjNh6T3sJyPHNFZpLUv8Z4AAPZBWufLLicy26G1mJS1L/GeAAD2QVrlRWdJU564yLa54HbOQlLkn9Z4ADPJBVuHIZ4ABf5CkuSf1ngAM8kFW4IisIgVzFJan/DHCAB7IKV2QFIZCruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOAAIgJ9rCIFcxSWp/wxwQCA9PT32kgj/eOZle6kjqK/riy+m2svR8HMNIZCruCT1nwEOCETqAKfo7zm11WWun3Tiebnvy/N+f2VSNn1/X9/a3HOKFL32E48/lzm/8QZjM8d6W/ReK5VKun/Qr44dvEmAWj0A6kWu4pLUfwY4oAG1stvOA5y9X4u6botNd073ixSt9/f3J9trr741d77ofej3udH6Y3LXTDji1GTLAIdOR67iktR/BjigAbWy204D3JrVazLr9n4RdX7iXY+k12271R6Z59quvPymzLF+bfO41n6t6xng0C3IVVyS+s8ABzRAZ/eCP1xjnZE9wCE8fq4hBHIVl6T+M8ABgTDAdTd+riEEchWXpP4zwAEBnHD8uQxwXY6fawiBXMUlqf8McECTDRu2fTK8McB1N36uIQRyFZek/jPAAY7UQDbsZyPS4WyoQnfj5xpCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVuGKrCAEchWXpP4zwAEeyCpckRWEQK7iktR/BjjAg7Ss/uv9j+2lQmXvW62XnWsG+9nq+Ja/3JM5tq+p5ZST/2AvieXzdQGuyFVckvrPAAd4kJZVe4ArGojMNfvc/fc+njmuVCqZ439/8Gmy1c+w7zfPFbHXy6697prbMse/2Hbv5LpZs37IrJsDnDp//LG/M85WqwsWLKoODAxk1mIp+jqBRpGruCT1nwEO8CAtqwcfeHz13Xc+TI/1gHTpJTdk1tZfb1S6b7KP7QHOVDZ8afa5suvffeff9lLpAGeyn6f27QFuj10Pq5537pWZtVjs9w80A7mKS1L/GeAAD2RVthUrVtpL0ZAVhECu4pLUfwY4wANZhSuyghDIVVyS+s8AB3iw/yc8sosyZAMhkKu4JPWfAQ7woLOqhzeKqlVAs5GruCT1nwEO8GBnddGiJZljQLOzAjQDuYpLUv8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVn9y9VW32EvV4cNGZo6b0a+i17H/xJav/fc9yl4q9NlnU+ylhMvX5XIN4ItcxSWp/wxwgAey+pOFCxfbS8kAZ/ZI79tbrda1Gw7fIT3Wa2NGjUv21QBnXm+WubbHrocWvqYa4F584fVkf9R2++Ve+847Hix8pt7azyzicg3gi1zFJan/DHCAB7L6k7IBzqT7tXx5/k9cmb084L+/ESvqr7mm9+3fwNlDlT102dQAV3ZO0eeef35Ssh0zepxxtvy5JpdrAF/kKi5J/WeAAzyQ1fYR+7OK/froTOQqLkn9Z4ADPJDV9nDVlTfbSy1HVhACuYpLUv8Z4AAP3ZbV5ctX2Etw1G1ZQWuQq7gk9Z8BDvDQLVlVXyfVeAHNRq7iktR/BjjAQ7dltdu+3maidwiBXMUlqf8McIAHsgpXZAUhkKu4JPWfAQ7wQFbhiqwgBHIVl6T+M8ABDnRG1dbMa9F60Xlzf9ut9ii979FHnslca+6//dYHpfe5vvZB444tvU///9wsum/27Lml95n7q1etztxn7p9z1qWl951w3LmZa8v27fvM/SlTvslca+7fcvM9pfftvuuhmWvL9u37zH37WnPfXAMaRZ7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeOiWrKqvc9my2v8JkXp7Ue997aZbvk60FrmKS1L/GeAAD92S1UmvvZNsTzj2d9aZQWYfbv7LT//zpEmt2esXXnBt9YN/fZJZ61T21w40A7mKS1L/GeAAD92SVT3AKU89+bxxZpDdh6JhTR8fcvCJ1W+/+T5dZ4AD6keu4pLUfwY4wEO3ZNUc4BpR1C8GOKB+5CouSf1ngAM8kFW4IisIgVzFJan/DHCAB7IKV2QFIZCruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAAzy0W1bvuftRe8nLww8+ZS+lip7dSH8auVeiTvt6IAO5iktS/xngAA/tllXz/ap9fWxuN/j5qMJzZfv6WvMe87x5jblun79n4qO5Z5rnlQlHnJpZN89J1y7vE+2FXMUlqf8McICHdstq0VBksgcnvVZrf/iwkUPep49rXafPVSqV3LqycuWqzHG7adf3DdnIVVyS+s8AB3ho56y24r1Pnvy1vdS1WtFvdB9yFZek/jPAAR7IKlyRFYRAruKS1H8GOMCDndVTTvpD5hjQ7KwAzUCu4pLUfwY4wIPOqtpS1FAFNBu5iktS/xngAA9mVvlHGrWQDYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAc4OHrCGelv3HQdf+w5uTVditpuveXu6b6LC86/Ot3X91x68Q2559cqfa/ra2oT//pw7v7773089/yi0vesXrU63Xehr3v1lbdyz6xV076dnnltZcqUb9L9MuY1Rc+qVfoe9V71fi3mPUCzkKe4JPWfAQ7wQFbhiqwgBHIVl6T+M8ABHsgqXJEVhECu4pLUfwY4wEOnZLXvw/+pVlc+QVFUJxWCk/RvAAMc4KFTssoAR1GdVz09Pfa3OppM0r8BDHCAh07JKgMcRXVeMcCFJ+nfAAY4wEOnZJUBTnYlOStYL6qBFY9XV8x/OLc+VJmv4fN6lNxigAtP0r8BDHCAh07JKgOc3Npo/dFJzvRQZW7ttaFqs43GJNeuXvRo7t6iAU5tb7hq8D+Zs8mGOxS+prlGySoGuPCS7AvBAAd46JSsMsDJrMVzHki2ekA6/OCDk+2EQw9J132GJzXA6X37vrIBTm2//fzO3DW67rnj/NwaJaMY4MKT9G8AAxzgoVOyygAnu3p+eDDdXzr3weT46ktPTdd2GbtXun/ab4+qbrHp2Nz9qtS99rOvvezUamX547lr1b7K98P3/LHau+Sx6qTnr828jwt+d0KyVfc+et+FuedS8YsBLjxJ/wYwwAEeOiWrDHBUURX9xo1qn2KAC0/SvwEMcICHTskqAxxFdV4xwIUn6d8ABjjAQ6dklQGOojqvGODCk/RvAAMc4KGTsqp+2FPhatjPRuTWKKrRGipXCEvSvwEMcIAHsgpXZAUhkKu4JPWfAQ7wQFbhiqwgBHIVl6T+M8ABHsgqXJEVhECu4pLUfwY4wANZhSuyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuVFY223gnezmoF1943V5qmJ15+xitRf/jktR/BjjAA1mFq6KsqDVVY0aNK1y373n1lbcyx5p9rT42B7j11xuV7pvUdS+9+Eayv2LFynRtnz2PrPb395uXpueWLVuROTb3H3zgyfTYtvkmO+e+JjSGfsYlqf8McIAHsgpXRVmxBy97veicTV2zyYZjc9eq49cnvZs5tj304FPJuh7gli1dnl5XdL2i1g8Zf2Lm2GQfm6ZO+dZeQoNq9RvhSeo/AxzggazCVTtlpa9vbbqvh8N2ev/dhM8lLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBc2yZk1vuk+u4pLUfwY4wEM3ZFX/z2cURckq/f2JeCT1nwEO8EBW4YqsoFlee+2ddJ9cxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVuGKrCAEchWXpP4zwAEeyCpckRWEQK7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeCCrcNWqrLz80pv2krNG7kUcrcoViknqPwMc4IGstif1uZml6D80b36m5v60b6cn219uu3d6zrzf3Nfs8yb1d0G1ovdTZMPho5OtumZgYCDZbrzBmGRt/fVGpmv6GVtstkt6/RWX35Tsf/HF1GSrbLLhjul5+/U3+Pnga0G2WnlBeJL6zwAHeCCr7UUNOIo9KJV9jmr9+j/dkR6/+cb7ydoOIw/IPUOxj2+6cWK6pq9/792PMsf2/ldfTcsMWfq8fXzu7y7PfQ16gFN+tf9v0nXzOvXsW2+5L9k//NCT02vsa+3XhEx8TnFJ6j8DHOCBrLanokGl6LMsW/vow8/s5WR97drBvyFqPlP/oXi1rwc/8xq9bx+b+3vtfnh6rNfM0mvm1txXf9S+6Ddw9v26KpVK5jmQi88pLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAc7q/YxoJENhECu4pLUfwY4wIPO6sqVq5J9sosyZAMhkKu4JPWfAQ7wYGaVAQ61kA2EQK7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DHOCBrMIVWUEI5CouSf1ngAM8kFW4IisIgVzFJan/DHCAB7IKV2SldVSvP/vPZHu5kOvnst2Ifeyl9N5jjjrLOlPb2NHj7KWU6/vRfK9Hc0nqPwMc4IGswhVZaR2z148+8nRyrGvGjNmZ68xr9f6IrfdM1zQ1wNmfob5/j10Pzazrc8phh5yUrq1evSZ5jh7g1l9vVHpO+fHHBel99muVcb0OYUjqPwMc4IGswhVZaR1zMFPbDYePTvZffunN3MCmj48/9nfr6pzq6O0PqO684/hkbdONdkyvrfUbOG3fvSdkXvfgg45P9zX1nP7+/mSIW7Omt3r3xEfTc2qA+/zzqck5873V4nINwpHUfwY4wANZhSuyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuyErz7DjmIPr5X/QhLkn9Z4ADPJBVuCIrzaN6ST8H0Ye4JPWfAQ7wQFbhiqw0V1/fWnupK5GruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrshK92rmZ6+fZW81+9iVuk/fu7RnWWZ9+fKV6TGy6u13CAxwgAeyCldkpTuZn7sekg4+6IRqpVJJ1r788qv0mqlTv03+3NcGPx+dnJ8zZ15671lnXpI+45ab70n/pqt+pir9p8LuveexZPvO2x8k17zyyluZ6zRz/7vvZiTb99//OFn/6qtp1fvu+Ru5HYKk/jDAAR7IKlyRle5kfu5r//ufPlEDXJmtt9y9unLlKns5pZ637VZ7Vs8/78r02BzM7K1mHm++yc7GmUF6gJs8+evSIQ95kvrDAAd4IKtwRVa6l/nZq9+sLViwKD1Wg9OiRUvS42f+/mK6P3v23GT7u7MvS9dmzfoh2S5fviLZqmf39CxL19VW36cHwWefeSnZavpak3pf8+cvTPbN80XX4ieSvq8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCEHlaqhCOJL6ywAHeCCrcEVWEIJPrnyuhRtJPWWAAzyQVbgiKwiBXMUlqf8McIAHsgpXZAUh+Obq8ENPtpfQAN/+h8QAB3ggq3BFVhACuYpLUv8Z4AAPZBWuyApCULnSVWao86ifpL4ywAEeyCpckRWEYA9wr77yVvWyS/5cnTZt8C8rICxJ39cMcIAHsgpXZAUh6Fz95aaJ1hm0gqTvawY4wANZhSuyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVuGKrCAECbk6+tdnJDWUY48+y16qqdbXVuv1at2nTf7ya3upLi6v1SoMcIAHsgpXZAUhNCNXX3w+NX2O2qp6+60Pku1eux+eWTdLO2bdYGa/j112OjjzTL3dcPjo9Br7NU3m2u67HJqu773nEcl2pzEHpWv9/f3J1n69F55/rbp4cU/yHzaePPmnga2vry9zXSOa8YxmYYADPJBVuCIrCKHRXL337kfJ1nyO2lcD3EHjjk3X9Hot9iCm9ye99k56vMWmu+QGrQsvuDYpmz5/xGEnJ9uTTjzPPJ1T9tzLL73RvIwBLiRJDQFqIatwRVYQQrNyZQ8/77/3UfWQg09Mzx9+yEnp/vrrjSp83TvveDBzPHzYyGS7aNGS6ptvvl8dM+pXyfGmG++UbPUzttx81+pG6+8weNN/bbrRjrn3ZO/ba0XbGdNnV6+8/C+Za/X5saPHpev1Kno/sTDAAR7IKlyRFYTQbrn6/vuZ9lJbk9R/BjjAA1mFK7KCEMhVa33++dTMsaT+M8ABHsgqXJEVhKByNTAwQLWoPvtsStLzffeekPZfCgY4wANZhSuyghDIVWup38CZPZfUfwY4wANZhSuyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSHEzJX52lMmf1O9686HjLNu783lGskkvX8GOMADWYUrsoIQYuSq6DXvufux6htvvJ8eVyqV9E9pmWbPnmsvVd95+4PCZypq/eCDjreXE+qceg3zXrVf9qwQWvlaQ2GAAzyQVbgiKwihVbkyByP9h+ftYcl+L/r4kouuH/I6XY88/HR63lw318z71ACn/si9/kP3e+5+eOG1obTiNVwxwAEeyCpckRWEQK7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeCCrcEVWEIKZK7U/b9584yxCk/R9zQAHeCCrcEVWEILOldoywLWepO9rBjjAA1mFK7KCEOxcMcC1lt3/mBjgAA9kFa7ICkIgV3FJ6j8DHAAEwM81hECu4pLUfwY4IJCenh57CV2k2T/X1PPWrOmtTnrtnaSaYdT2+2eOXd6zyzU2855DD/6tcaaafC1z5sxL9q+47KZ0vdHXMdeOOfqswnPtqFO+jnYlqf8McEAgDHDdrdk/1+bPX5hs9XPVVu/vtssh6XVF5/V21arV6XWmO+94MP2v45v3/HXd+rlnX56u2+eVjTcYk1s75aQ/JFu9ZpYa4PR1+rw2a+YPuTVNr+lhzH4v/f39ufdhXnPm6Rcn23ZX1Bu0jqT+M8ABHnyyygDX3Xyy4sIe4Pr61pqnc8pef9R2+9lLmQFOmTr122RrD0nKCceeO3jTOoeMP7H0dYruVezfwJnX3X3XI5lj8xr72HeNAQ7NIKn/DHCABzOr//l0ci675jEDXHezs9EoPcA10+TJ39hLYqiBspkY4NAMkvrPAAd4sLNa65gBrrvZ2QCagVzFJan/DHBAIAxw3Y2fawiBXMUlqf8McEAAG2+8IwNcl+PnGkIgV3FJ6j8DHNBkanBTtWzZMvsUugg/1xACuYpLUv8Z4ABHaigb9rMR6YA2VKG78XMNIZCruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQArmKS1L/GeAAD2QVrsgKQiBXcUnqPwMc4IGsdiaXz9XlGkVfZ27ttVomvfZO9eADj8+sjdhmr8yxr5kz52SOzz7zkmQ7/sDjMuuQzyVDCEdS/xngAA9ktX2pz27mjDnV4cNGJsfLl6/IDVavT3o3vd5kX6dVKgO5NT2w6fUZM2Zn7n/phdeT/Q/+9Ul6z8S7Hk731QB3w/V3pseKGuDs11GK1rbYdBd7Kbnuyy+mpsennfLHn06irRR95mgdSf1ngAM8kNX2pj+/iy/8U3p8xKGnVD//fGpu8DJdfumN6blTT74gWdtw+OjM9eb99vo1V99a/fWRp+XOnX7ahYMvYFADnGY/214zmetbb7Fbbp0BrjPYnztaS1L/GeAAD2QVrkJnpRnPr1Qq9hKEa8bnjvpJ6j8DHOCBrMIVWUEI5CouSf1ngAM8mFlV+2QXZcgGQiBXcUnqPwMc4EFntadnKQMcaiIbCIFcxSWp/wxwgAc7q78+4rTMMaDZWQGagVzFJan/DHCAB7IKV2QFIZCruCT1nwEO8EBW4YqsIARyFZek/jPAAR7IKlyRFYRAruKS1H8GOMADWYUrsoIQyFVckvrPAAd4IKtwRVYQQrvkynyfvu9ZXf/+ex+n+0XeeOP9ZLvBz0dn1suuL3L8sb9Ltj73+FwbGgMc4IGswhVZQQguuXr7rQ8yx+Y92/9i3+RYl31N0fPNtWnfTs/dW8Q8v/ceR+Suv+aqW5Lt/B8X5M6pY3OA23ns+Gp/f3/uGlcbrb/DukFvlL1cF5/XDY0BDvBAVuGKrCAEl1zVGuD0sT2E2deY7HPDh43Mrc2bOz9zbJ5XA5yybNnydM1kP0sdmwOcfT4mSe+FAQ7wQFbhiqwghHpz9fJLb9pLybOe/vsLmbV33v535ti2auXqdP+fz72SbF94flK6Vov67Z22du3gb9QWLVySrtWyYMEie6nQZZf+2V5KTJv202vbfHrqc21oDHCAB7IKV2QFIZCruCT1nwEO8EBW4YqsIARy1Vqffz41cyyp/wxwgAeyCldkBSGoXFFxSvdfCgY4wANZhSuyghDIVWup38CZPZfUfwY4wANZhSuyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCKFdc3XLzffaS21JUv8Z4AAPZBWuyApCaHWuWv16+m+kuhgYGLCXgmt1P2phgAM8kFW4IisIodW5Uq/3r/cH/y6pPt5nzyPTfXOr2cfKvntNSLbmuWeefil3rTnAqXNPPP5cevzSi2+k6/Z9rRLrdYswwAEeyCpckRWE0Opcma+nBydzgFN1w/V3Fl6n19TWHuDUdvr0Wcl2i013ydy7526Hpft6gDPvM/fNbSu08rWGwgAHeCCrcEVWEAK5iktS/xngAA9kFa7ICkIgV3FJ6j8DHOCBrMIVWUEI5v9sqGrevPnWFQhJ0vc1AxzggazCFVlBCDpX6v9OjAGu9SR9XzPAAR7IKlyRFYRAruKS1H8GOMDBDz/8WJ02bUaSVbVVNXfu/HTfLkVtv/9+VrrvYv78Rem+vmfBgsW559cqfa/ra2pLlizN3d/Tsyz3/KLS9+j/LpPra+vrVqxYlXtmrert7cu8ttLb25vulzGvKXpWrdL3qPeq92vRP9f0dao35nOGKrP3+h71Gfmw73ctlTl9j2ZmsxZ9j8q+/Vy7zO8hfa/6XvMxa9YP6b5+1uzZc3OvZdfMmXPSe7QZMwbXhqLvmTdvQea9D1XmdeZzhrJo0ZJ0X/8MUmv282uV5vqa2tKlyzPvd6jq769kXnNwrd98ZKFVq1an+/re1atX555fq1avXpO5Xz9jKGvXrs28X1Vr1/bnnq/K/DcgNgY4wANZhSuyghDIVVyS+s8AB3ggq3BFVhACuYpLUv8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJBVuCIrCIFcxSWp/wxwgAeyCldkBSGQq7gk9Z8BDvBAVruX+dn/7bF/GGeKqetVff/dTPtUTQcecIy9VIo8dh8+87gk9Z8BDvBAVrub/vzNAU6tjdp+/3RfX6O2D9z/RCYz+vyZZ1ycrpnMe1VNmfxN7rz9PHQXPvO4JPWfAQ7wQFa7lz2c6e3tt91fOsCZzjj9ovS8OcDZ16nj4cNG5p5TtLXvRefjM49LUv8Z4AAPZBWuyApCIFdxSeo/AxzggazCFVlBCOQqLkn9Z4ADPJhZ5X/CQi1kAyGQq7gk9Z8BDvDAAAdXZAMhkKu4JPWfAQ7wYGf1n8+9mjkGNDsrQDOQq7gk9Z8BDvBAVuGKrCAEchWXpP4zwAEeyCpckRWEQK7iktR/BjjAA1mFK7KCEMhVXJL6zwAHeCCrcEVWEAK5iktS/xngAA9k1V9Rz345Yh97ydkmG+2YbNVzi55t23arPdJ913uaoVWvg+5CruKS1H8GOMADWa3PP//5auZY9bG/vz+3NjAwkB4fcvCJyXb99Ualaybzs9CDmV67/rrbk+1RE07PDHCaee85Z15qnMl/xvaxq3rvA2ohV3FJ6j8DHOCBrPo58rBTkq3dt6LfwOlrrrn6lvR43P7HmJfkhjabHuIqlUpy7DLAmcdq+/FHn1UnvfZOeq63tzfd92G/BtAM5CouSf1ngAM8kNXOYw5vzdTs5wEKuYpLUv8Z4AAPZBWuyApCIFdxSeo/A1yHoqdh0Fe4IisIgVzFJan/DHAdRvWSoiiK6txCPJL6zwDXoehpGPQVrsgKQiBXcUnqPwMc4IGswhVZQQjkKi5J/WeAAzyQVbgiKwiBXMUlqf8McIAHsgpXZAUhkKu4JPW/7gFu3rm9TSvVEHut3qpW7Hcqy8ZfTGrLajdrb9w+SKms2mvNrHr1DVSr//fzxaJq0dqf/qqCFJ+u/r6623cXtqRUVuy1UNU70Gd/qS3x3nP91Yev6WvbapY1p53WslK5stdC1sAPP9hfbvvoX1rt+/B/mlqq//Zao1Wvuga4yrJ1tUJuSdVT6Wvbem3ZfPvLESsZhFYvasuqZ4j7anV/deG6WUliHTNjuf12o1GDTs+6HxCdWq2mBqCV6z7edq6Gh7j+/urAsmUdX2vOPtv+ysXrn3dzdaB/XnvU2jn223dS3wBXMDRJKvWbuJ6eHvttRzVyyttVeyhquxLW01IFg1G7VOWTh737rH7bZQ9OUkq9N9+vJ5ROH+Ba3edOGOBUNdK35DdUBQNPp1XydRp/p7gdqN9s5QYlwVVPDhngWoQBroUKBqN2KQa4cLphgOvra/A3Sh4Y4LprgGukTzEwwJWoFAxNkooBLlAJ62mpgsGoXYoBLhwGuOZigGOAk4wBrkSlYGiSVAxwgUpYT0sVDEbtUgxw4TDANRcDHAOcZAxwJSoFQ5OkYoALVMJ6WqpgMGqXYoALhwGuuRjgGOAkY4ArUSkYmlxq8ZxluTWz1P/3XHttqFL32Pe1wwA3f/XKzHFRvfXhJ7k1n1J9sdd8Kne/sJ6WMgailYvnJNvkv91TMDDpOvrIk9P9ibdNzJ23a2DVwtxaM0rCAPfIMy8n2zseeDKzrnpoXztUSR7g7rjnwcxxs+v0sy7Krdk1+D2WX3epLTffNbsWeYC74rJbc8ORaz3/j7eTreqHfa6snnr8ldxaPdVIPu0Bbs3CRbnhR5f62uw1VU89/PfcWjOq7PVcztvnun2AW7NqVm5NVdKndds3Jr2QO2fWphuNzRyPH3d0eq+uevrblAFOD1Dmtr9kuFo8Z2nuvu223Se9Vq9t/4v9qtuP2Df3XL21rzerHQa4sWMOzBzbA9OV192WWzfP77ffYAD0+uQZM5Ltkv7e0meq/T33PCLZHzXygMLz9nWZEtbTUtZQNGbk/snXpPbV9psvPk2P9Zo5wJm1/z5H5tbse998+eXM8+2tWdtsuVvumkfvfzh9XisGuFPOuCR9P3rt5rseTY/tc+aavT5USR3g1NdRtG8e66/XXDto/HHVY447O9kfO2Zc7lrzWA9wX835PrO+807jM6+n6sJLr1v3Q37HzHuwX1tvr7vx9tx7TiriAKfej9pefOFN1ZnfL1z3ffObzLr+eszrhw8bmRmkzGv0dszoA6tLFvVm1lTdc9eTuddW2+uvuzvzLPv1Va1YNpB53UbyaQ9wkz/8NB2AVJnDkN6a54uuK9vX23H7HpWeWzV/Qea8eZ9eO+6oM6sb/Hx04evaz554y725Z6hq9wFOZU1tt95i1+Tru+iPlyXHmT7891htX3np2XTfXC+qouvM567t/aH65WfvpcdTJ3+Qe4aqevrb1AHOrqJ1PcBtvsnOuWvt64vWzOfuuO6bW+9ff9Wd6fl2GOD012av5YamgvNqe9vEh3Pni0pdu8/eEzLHf7n9vtx1dhW+F2E9LWUNXEVDl3msqmyAG7ffr3Nr9r32sblmb487+vT0Gv1bPPP+Vg1waqte11y3j+1ztc6XldQBrqxOOvX8ZLukf3ny9U6d9V3mvBrg9L46/8EXn/33eyX/LDXA2efM4z9ecl3unoee+HvuOrW/uG9ZeqwGuEV9S3P3ShjgDhp3QrK/1x5HVufPW5kZnvba/cjM4FRU+jl63xzgysq+p9b+vB+W5+5vJJ/2AKe/VlXm+p+uuCm3Zg5ORWU+p+g6e8081kOeuVZZujSzprbJYGPcrwa4BdNn5l6r3Qc439p8k50yx6o3E444MXedPjfUmh7g7OvMqqe/DQ9whx98crr/4MSnku2XH3+TG7oaqbXLKsn2z9fclTtXVO0wwA1VTzz3cvWzb6cl++f98ZrcebPe+/SzZPvJ199k1u3fxs1fpX7Q5+9X9eDjz6b7N9/5QLJVgctcJ6ynpYxB6uXn/lldMm96ejz5k39nzqt67/VJmeMJh/023Vc9sK+/7abbc2sLZ09Ltk89+nhm/Z477s4945nHn0y2//z707nntGKAq1UffTM93T9iwhnJ9ua7HknXnn717dw9tUryAHf4kack29vvzv5PqXNXLEy2g/kfXHvgsScz1/iWHsyGKvM17Xr25VdqXxtxgFO14w7jc8PRVVfcnmxPPemiZLgzz33z1dx0/+gJZ2XO3Xn7Y8n26ylzcs/U9Yff/ylz/MPsnszx/LmDA+QmG+5YveO2wd8w289Q1Ug+7QGuqD7/18eZY3OoMusff3s2czz148/SoasZ1bd4SW5N11+uvS23ZlYnDHCvvfyPdL+yNj9Aqbrq8qtza7XqmiuvTbZ33Hpr7txQNWr7fTPH9fS34QFOYnXCACeyhPW0lDUUxSz1w3qf3Q/NrZdV7AGu2SV5gOu4ijzA1Sr1fVA2QIWuTz/+tuZrN5JPlwGuE6oTBjjpVU9/GeBahAGuhQoGo3YpBrhwGOCay2eAk1yN5JMBTi4GuBKVgqFJUjHABSphPS1VMBi1SzHAhcMA11wMcAxwkjHAlagUDE2SigEuUAnraamCwahdigEuHAa45mKAY4CTjAGuRKVgaJJUDHCBSlhPSxUMRu1SDHDhMMA1FwMcA5xkDHAlKgVDk6RaPm1VXc0ILTcQtVsJ7GmR/r8dlxuM2qXW3ri9d5+vnbcqNzhJKQa4FhYDnHepr6GRfFa+/z437HRiMcCFr3r6W9cAVx0Y/C2XxFr82OBv3+ppRmizeldXN/5iUluW1J6WUYNQO1a9fT7s++XJsCSp1vtiUd1fTyhqiOvEOnn27VH6rAagdq5m5LPv8ceTAaeTS/WoUqnYX7p4ff/ZOBnkpNfSnvr+H7r1DXDrDAwMpOGXWFKtWjX428F2rXZiv/d2qXrZz5FS0tjvr1Nq6dKl9pfaEvb7aLdqBvuZnVjtyv46JJevugc4AAAAxMEABwAA0GYY4AAAANoMAxwAAECbYYADAABoMwxwAAAAbYYBDgAAoM0wwAEAALQZBjgAAIA28/8DsJguEd+ddc4AAAAASUVORK5CYII=>