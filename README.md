# Clausync AI

AI-powered contract analysis platform that helps teams understand, compare, and manage legal documents at scale.

## Architecture

Clausync AI uses a **distributed worker architecture** — each service handles a specific stage of the document processing pipeline:

```
clausync-ai/
├── apps/
│   ├── api/                  # Core REST API (TypeScript)
│   ├── web-app/              # Main web application (TypeScript)
│   ├── landing-page/         # Marketing site
│   ├── ingestion-worker/     # Document upload & parsing
│   ├── analysis-worker/      # AI-powered clause analysis
│   ├── vectorize-worker/     # Embedding generation for semantic search
│   ├── reports-worker/       # Report generation & export
│   ├── data-export-worker/   # Bulk data export processing
│   ├── notification-worker/  # Email & in-app notifications
│   └── cleanup-worker/       # Data lifecycle management
├── docs/                     # Project documentation
├── scripts/                  # Build & deployment automation
└── docker-compose.yml        # Local development orchestration
```

## Tech Stack

| Layer           | Technology                              |
|-----------------|-----------------------------------------|
| **Frontend**    | TypeScript, React                       |
| **API**         | TypeScript, Node.js                     |
| **AI/ML**       | Python, LLM-based clause analysis       |
| **Database**    | PostgreSQL (PLpgSQL)                    |
| **Search**      | Vector embeddings for semantic search   |
| **Workers**     | Distributed async job processing        |
| **Infra**       | Docker, Shell scripts                   |

## Key Features

- **AI Clause Analysis** — Automatically identifies, categorizes, and summarizes contract clauses using LLMs
- **Semantic Search** — Vector-based document search via embedding generation (vectorize-worker)
- **Document Pipeline** — Ingestion → Analysis → Vectorization → Reporting, each handled by a dedicated worker
- **Report Generation** — Automated contract comparison reports and risk summaries
- **Notifications** — Real-time alerts for document processing status and review requests

## Getting Started

```bash
# Clone the repository
git clone https://github.com/dave-manufor/clausync-ai.git
cd clausync-ai

# Start all services with Docker
docker-compose up

# Or run individual services
cd apps/api && npm install && npm run dev
cd apps/web-app && npm install && npm run dev
```

## License

MIT
