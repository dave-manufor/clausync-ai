Error-Handling Standards

1. General Philosophy
   No Silent Failures: Never catch an error just to ignore it (unless explicitly commented with a valid reason).

Contextual Logging: Errors must be logged with sufficient context (e.g., user_id, file_path, transaction_id) to reproduce the issue.

User vs. System:

System Errors: Log the full stack trace and technical details internally.

User Errors: Return a clean, sanitized message to the client (e.g., "Service unavailable" instead of "ConnectionRefusedError: port 5432").

Clean Up: Always release resources (connections, file handles) using finally blocks or resource managers.

2. Python Error Handling
   Structure & Syntax

Avoid Bare Excepts: Never use a bare except: or except Exception:. Always catch the specific exception you expect (e.g., except ValueError: or except requests.exceptions.Timeout:).

Exception Chaining: When catching an exception to raise a new one (e.g., wrapping a library error in a domain error), use raise ... from e to preserve the original stack trace.

Custom Exceptions: Define domain-specific exceptions (e.g., PaymentProcessingError, UserNotFoundError) to make error handling semantic.

Context Managers: Prefer with statements for resource management (files, network sessions) to ensure automatic cleanup even if errors occur.

Example:

Python

class DataIngestionError(Exception):
"""Raised when data ingestion fails."""
pass

def process_file(filepath: str) -> None:
try:
with open(filepath, 'r') as f:
data = f.read() # process data...
except FileNotFoundError as e: # Wrap the low-level OS error in a domain-specific error # 'from e' keeps the link to the original FileNotFoundError
raise DataIngestionError(f"Configuration file missing at {filepath}") from e
except PermissionError: # Handle specific case
print("Permission denied.") 3. TypeScript Error Handling
Structure & Syntax

Throw Errors, Not Strings: Always throw Error objects (new Error("...")), not primitive strings or objects. This ensures stack traces are generated.

Handling unknown: In TypeScript (especially with useUnknownInCatchVariables enabled), caught errors are type unknown. You must use type guards or instanceof checks before accessing .message.

Async Handling: Use try/catch blocks for async/await. Avoid mixing callbacks and promises unless necessary.

Global Handling: Ensure unhandled promise rejections are caught at the application root (e.g., process.on('unhandledRejection') in Node).

Example:

TypeScript

class DatabaseError extends Error {
constructor(message: string, public query: string) {
super(message);
this.name = 'DatabaseError';
}
}

async function fetchUser(userId: string): Promise<User> {
try {
return await db.users.findById(userId);
} catch (error: unknown) {
// Type Guard: Check if it is a real Error object
if (error instanceof Error) {
// Re-throw with context
throw new DatabaseError(`Failed to fetch user: ${error.message}`, "SELECT \* ...");
}
// Fallback for non-error throws
throw new Error('An unexpected error occurred during fetch');
}
} 4. Anti-Patterns (What to Avoid)
The "Pokemon" Handler: Catching them all (except Exception / catch (e)) without re-throwing or handling specifically. This hides bugs.

Return Codes: Do not return error codes (like -1 or false) to indicate failure. Use Exceptions. This keeps the "happy path" code clean and separate from error handling logic.

Leaking Internals: Never return raw database errors (e.g., "SQL syntax error near...") to the frontend API response.
