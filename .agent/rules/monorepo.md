---
trigger: always_on
---

### **Monorepo Strategy: The "Polyglot Service" Model**

**Context:** The system combines **Node.js (Express)** for the API, **Python** for heavy compute (Scrapers/AI), **React** for the Dashboard, and **Next.js** for the Landing Page. **Goal:** Maintain strict service isolation while unifying versioning and infrastructure.

---

### **1\. Principle: Structural Isolation by Deployment Unit**

**Guideline:** Organize the repository by **deployable artifact** (application), not by language or file type. Each directory in `apps/` must be a self-contained unit that can be deployed independently to Cloud Run.

* **Directives for the Agent:**  
  * **Apps Directory (`/apps`):** Place all deployable services here.  
    * `/apps/api-gateway`: The Node.js/Express service.  
    * `/apps/ingestion-worker`: The Python/Playwright scraper.  
    * `/apps/analysis-worker`: The Python/Vertex AI analyzer.  
    * `/apps/web-app`: The React application (User Dashboard).  
    * `/apps/landing-page`: The Next.js marketing site.  
  * **Infrastructure Directory (`/infra`):** Terraform scripts must reside here, mirroring the `apps/` structure to define the resources (Pub/Sub, Cloud SQL) required by those apps.

    ### **2\. Principle: Schema-First Event Communication**

**Guideline:** Since the architecture is **Event-Driven** and decouples the API from Workers via Cloud Pub/Sub, the "Contract" (Event Schema) is the most critical dependency.

* **Directives for the Agent:**  
  * **Single Source of Truth:** Define all event payloads (e.g., `cmd.scrape_url`, `event.change_detected` ) in a language-agnostic format (e.g., JSON Schema or Protobuf) within `/packages/shared-schemas`.  
  * **Type Generation:** Do not manually write types. Use the schema to generate TypeScript interfaces for the API/Frontend and Pydantic models for the Python Workers.  
  * **Validation:** Both the Publisher (API) and Subscriber (Workers) must validate messages against these generated schemas at runtime to prevent "poison pill" messages.

    ### **3\. Principle: The "Compliance Wrapper" Pattern**

**Guideline:** Security and compliance controls (SOC 2, GDPR) must be abstracted into reusable utility libraries, not reimplemented in every service. The agent should default to using these wrappers.

* **Directives for the Agent:**  
  * **Database Access:** Never write raw SQL without the RLS wrapper. Use a shared library that automatically appends `WHERE user_id = :current_user` to every query to satisfy the Row-Level Security requirement.  
  * **Storage Access:** Interactions with Google Cloud Storage must go through a wrapper that respects the **WORM (Write Once, Read Many)** requirement, ensuring existing snapshots are never overwritten.  
  * **Encryption:** Secrets (API Keys) must be retrieved from environment variables injected by **Secret Manager**, never hardcoded or stored in `.env` files committed to the repo.

    ### **4\. Principle: Hermetic Dependency Management**

**Guideline:** Prevent "Dependency Hell" in a mixed Python/Node.js environment by enforcing strict boundary checks at the service level.

* **Directives for the Agent:**  
  * **No Root Dependencies:** The root `package.json` should only contain build tools (e.g., Turborepo, Husky). Runtime dependencies (e.g., `express`, `langchain`) must be installed strictly within their respective `apps/` directories.  
  * **Python Isolation:** Each Python worker must have its own dependency definition (`requirements.txt` or `pyproject.toml`) to avoid conflicts (e.g., `ingestion-worker` needs Playwright , while `analysis-worker` needs Vertex AI SDK ).  
  * **Docker Context:** Dockerfiles must be written to assume the monorepo root is the build context, but they must `COPY` only the specific app directory and its internal shared dependencies to keep images small and secure.

    ### **5\. Principle: Infrastructure as an Application Dependency**

**Guideline:** The infrastructure configuration (Terraform) is as much a part of the application as the code itself.

* **Directives for the Agent:**  
  * **Environment Parity:** The environment variables defined in Terraform (e.g., `DB_HOST`, `PUBSUB_TOPIC_SCRAPE`) must match the configuration interfaces used in the application code.  
  * **Drift Prevention:** When adding a new service or queue, the Agent must first define the resource in `/infra` before referencing it in `/apps`. Code requiring a resource that doesn't exist in Terraform is a build failure.

