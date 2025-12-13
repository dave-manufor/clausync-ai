Security Mandates

1. General Principles (Zero Trust)
   Secrets Management:

Strict Prohibition: Never hardcode API keys, passwords, tokens, or encryption keys in source code.

Mechanism: Use environment variables (e.g., os.environ or process.env) or a dedicated secrets manager.

VCS: Ensure .env files and private keys are included in .gitignore.

Least Privilege: Functions and database users should operate with the minimum permissions necessary to perform their task.

Sanitization: Treat ALL user input (request bodies, query params, headers) as untrusted. Validate and sanitize at the entry point.

2. Python Security Mandates
   Data Handling & Storage

SQL Injection:

Prohibited: Never use F-strings or string concatenation (+) to build SQL queries.

Mandated: Use an ORM (like SQLAlchemy or Django ORM) or parameterized queries (e.g., cursor.execute("SELECT \* FROM users WHERE name = %s", (name,))).

Serialization: Avoid pickle for untrusted data. Use json or msgpack instead to prevent arbitrary code execution vulnerabilities.

XML/YAML: Use defusedxml for XML parsing and yaml.safe_load() instead of yaml.load().

Cryptography & Randomness

Randomness: Use the secrets module for generating security tokens, passwords, or salts. Do not use the standard random module for crypto purposes.

Bad: random.choice(chars)

Good: secrets.choice(chars)

Example:

Python

import os
import secrets
from flask import request

# BAD: Hardcoded secret and unsafe random

# API_KEY = "12345-abcde"

# token = random.randint(0, 10000)

# GOOD:

API_KEY = os.getenv("API_KEY")
if not API_KEY:
raise RuntimeError("API_KEY environment variable not set")

def generate_secure_token() -> str:
"""Generates a URL-safe secure token."""
return secrets.token_urlsafe(32) 3. TypeScript Security Mandates
Input & Rendering (XSS Prevention)

DOM Manipulation:

Prohibited: Avoid innerHTML, outerHTML, or document.write whenever possible.

React Specific: Avoid dangerouslySetInnerHTML. If it is absolutely required, the input must be sanitized first using a library like DOMPurify.

Client-Side Secrets:

Strict Prohibition: Do not expose server-side secrets (AWS keys, Database URLs) in frontend TypeScript bundles. Assume all client-side code is public.

Node.js / Server-Side TS

Prototype Pollution: When merging objects, prefer Object.assign() or spread syntax over recursive deep merge functions unless using a hardened library (like lodash with known patches).

ReDoS (RegEx Denial of Service): Avoid vulnerable regex patterns (nested quantifiers). Use tools like safe-regex to validate patterns if they run against user input.

4. Logging & Monitoring
   PII Redaction: Logs must not contain Personally Identifiable Information (PII) like emails, phone numbers, or passwords.

Exception Handling: Do not expose full stack traces to the end-user/client in HTTP responses. Stack traces should only go to internal logs.
