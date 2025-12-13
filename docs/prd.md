**Changes in Version 3.0:**

* **Tech Stack Alignment:** Updated all generic references (e.g., "Vector DB") to the specific chosen GCP stack (**Cloud SQL pgvector**, **Vertex AI**).  
* **Compliance:** Added specific **SOC 2 Type II** and **GDPR** controls (WORM storage, Row-Level Security).  
* **Architecture:** Integrated the **Singleton Resource** pattern and **Event-Driven** workflows defined in the System Architecture Document.

---

# **Product Requirements Document (PRD): LegalWatch AI**

Version: 3.0

Status: Ready for Engineering

Date: December 11, 2025

Cloud Standard: Google Cloud Platform (GCP)

---

### **1\. Executive Summary**

**LegalWatch AI** is an automated risk intelligence platform designed to monitor, analyze, and interpret changes in third-party vendor agreements. It utilizes a **Singleton Resource Architecture** to efficiently monitor thousands of vendors at scale, coupled with a **Context-Aware RAG Engine** (Retrieval-Augmented Generation) to tell specific clients not just what changed, but how it conflicts with their internal policies.

---

### **2\. User Personas & Problem Statements**

| Persona | Role | The "Migraine" (Pain Point) | Success Metric |
| :---- | :---- | :---- | :---- |
| **The "General Counsel"** | Strategic Risk Manager | "I don't care if AWS changed a font. I need to know if their new Indemnification clause conflicts with our standard MSA." | Personalized conflict detection. |
| **The "CISO"** | Security Architect | "Did Zoom just change their ToS to allow training AI on our proprietary calls?" | Immediate detection of data sovereignty violations. |
| **The "DevOps Lead"** | Technical Lead | "We have 500 users tracking the same 10 URLs. We cannot run 5,000 scrapers daily without getting blocked." | \>90% reduction in redundant requests via Singleton Architecture. |

---

### **3\. Functional Requirements**

#### **3.1 The Ingestion Engine (The "Singleton Scraper")**

* **REQ-1.01 (Deduplicated Monitoring):** System must utilize a relational "Many-to-Many" architecture1.  
  * **Logic:** System monitors the Resource (URL \+ Selector), not the User.  
  * **Benefit:** 10,000 users tracking openai.com/terms results in **1 scraper execution**2.  
* **REQ-1.02 (Selector-Based Granularity):** The unique identifier for a resource is the tuple {URL\_Hash, CSS\_Selector}3.  
* **REQ-1.03 (Anti-Detection):** Scraper must utilize **Playwright** with stealth plugins and rotating residential proxies (Bright Data/Oxylabs) to mitigate 403 blocks444444444.

#### **3.2 The Analysis Engine (Two-Tiered AI)**

* **REQ-2.01 (Tier 1 \- Global Analysis):**  
  * **Semantic Diff:** On change detection, generates a "Global Diff" identifying added/removed clauses, ignoring styling/formatting5555.  
  * **AI Model:** Uses **Vertex AI (Gemini 1.5 Pro)** for high-context summarization6.  
  * **Output:** A generic "Traffic Light" score (Green/Yellow/Red) saved to change\_events7777.  
* **REQ-2.02 (Tier 2 \- Personalized RAG):**  
  * **Context Ingestion:** Users upload "Context Documents" (PDF/Docx/URL) defining their legal posture (e.g., "No binding arbitration")8.  
  * **Vectorization:** System creates embeddings of User Context Docs using **Cloud SQL (pgvector)**999.  
  * **Conflict Check:** When a "Red Risk" change is detected, the system queries the user's policy vectors and prompts the LLM: "The vendor changed X. The user's policy says Y. Is there a conflict?"10101010.

#### **3.3 The Compliance Vault (Storage Strategy)**

* **REQ-3.01 (Immutable Evidence):**  
  * **Storage:** Raw HTML snapshots must be stored in **Google Cloud Storage (GCS)** buckets.  
  * **Protection:** Buckets must have **Object Versioning** and **Bucket Lock** (Retention Policy \= 7 Years) enabled to serve as a legal "Digital Notary"111111.  
* **REQ-3.02 (Structured Analysis):** JSON diffs and risk vectors must be stored in Cloud SQL for structured querying12121212.

---

### **4\. User Interface (UI) Requirements**

#### **4.1 The "Context" Settings**

* **REQ-4.01 (Business Profile):** A dashboard section where users define their "Legal Posture" by dragging and dropping internal policy documents (MSAs, Privacy Frameworks)13.

#### **4.2 The Intelligence Dashboard**

* **REQ-4.02 (Dual-View Alerting):**  
  * **View A (The Fact):** "AWS updated Section 5.1." (Tier 1 Analysis) 14.  
  * **View B (The Impact):** "This violates your 'No-Third-Party-AI' policy uploaded on 10/24." (Tier 2 RAG) 15.

---

### **5\. Data Strategy & Schema**

The database schema utilizes a **Converged Database** approach using PostgreSQL for both relational data and vector embeddings16.

#### **A. monitored\_resources (The Singleton)**

* id (PK): UUID  
* url\_normalized: TEXT (Unique Index alongside selector)  
* selector: TEXT (Default: body)  
* current\_hash: SHA256  
* last\_scraped\_at: Timestamp171717171717171717.

#### **B. resource\_snapshots (The History)**

* id (PK): UUID  
* resource\_id (FK): UUID  
* gcs\_uri: TEXT (Link to WORM-locked HTML)18.  
* text\_content: TEXT (Cleaned Markdown).

#### **C. change\_events (The Intelligence)**

* id (PK): UUID  
* new\_snapshot\_id (FK): UUID  
* diff\_json: JSONB (Structured diff)19.  
* global\_ai\_analysis: TEXT20.  
* global\_risk\_score: INT (1-10)21.

#### **D. user\_context\_embeddings (The RAG)**

* user\_id (FK): UUID  
* embedding: VECTOR(768) (Compatible with Vertex AI text-embedding-004)22222222.  
* content\_chunk: TEXT.

---

### **6\. Technical Architecture & Logic Flow**

The system follows a **Cloud-Native, Event-Driven Microservices Architecture** on GCP23.

#### **6.1 Logic Flow (Event-Driven)**

1. **Ingestion:** API receives POST /monitors $\\rightarrow$ Checks monitored\_resources $\\rightarrow$ Publishes cmd.scrape\_url to **Cloud Pub/Sub** if new24242424.  
2. **Scraping:** **Ingestion Worker (Python/Cloud Run)** consumes message $\\rightarrow$ Checks Redis Lock $\\rightarrow$ Fetches via Proxy $\\rightarrow$ Saves to GCS WORM $\\rightarrow$ Computes Hash25252525.  
3. **Detection:** If Hash changes $\\rightarrow$ Updates DB $\\rightarrow$ Publishes event.change\_detected26.  
4. **Analysis:** **Analysis Worker (Python)** consumes event $\\rightarrow$ Runs Tier 1 (Gemini) $\\rightarrow$ Fans out to relevant subscribers $\\rightarrow$ Runs Tier 2 (RAG) using user\_context\_embeddings $\\rightarrow$ Sends Alert27272727.

---

### **7\. Security & Compliance Requirements**

#### **7.1 Confidentiality (SOC 2\)**

* **Encryption:** Data-at-rest encrypted via **Customer-Managed Encryption Keys (CMEK)**. Data-in-transit via TLS 1.328282828.  
* **Tenant Isolation:** All SQL queries must utilize **Row-Level Security (RLS)** patterns (WHERE user\_id \= :current\_user)29.

#### **7.2 Integrity (Legal Admissibility)**

* **WORM Storage:** **7-Year Retention Policy** on GCS buckets to ensure snapshots are immutable30.  
* **Audit Logging:** All "Write" actions logged to **Cloud Logging** and exported to a separate Audit Project31.

#### **7.3 GDPR Compliance**

* **Data Residency:** Users select a "Home Region" (e.g., europe-west1). PII is stored only in that region32.  
* **Right to be Forgotten:** API trigger for hard deletion of user rows33.

---

### **8\. Success Metrics**

* **Deduplication Efficiency:** Target \> 10x ratio of Total Subscriptions / Total Scrapes34.  
* **Financial Break-Even:** Achieve cash-flow positivity with **\< 3 Enterprise Customers** (based on Lean MVP analysis)35353535.  
* **Latency:** Time from Vendor Update on web $\\rightarrow$ User Alert delivered \< 4 hours36.

---

### **9\. Disclaimer**

This system involves scraping third-party websites. The engineering team must respect robots.txt where possible and ensure the scraping frequency does not constitute a Denial of Service (DoS). The "Fair Use" of the scraped data relies on it being for internal analysis/transformative use, not republication37.

