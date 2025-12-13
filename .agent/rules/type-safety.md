Type-Safety Mandates

1. General Philosophy
   The "No Any" Rule: The use of any (TS) or Any (Python) is strictly prohibited unless wrapped in a specific "unsafe" boundary layer (which must be heavily commented).

Boundaries are Unsafe: Do not trust data coming from outside (API responses, JSON files, user input). You must validate these at runtime using schema libraries (Pydantic for Python, Zod for TypeScript) before casting them to static types.

Strict Config: Both languages must run in their strictest available type-checking modes.

2. Python Type Safety
   Configuration

Tooling: Use mypy or pyright in strict mode.

Typing Imports: For Python 3.9+, use built-in collection types (list, dict) where possible. For older versions or complex structures, use typing.

Rules

Explicit Optionals: Never assign None to a variable without declaring it as Optional.

Bad: user_id: int = None

Good: user_id: Optional[int] = None

Protocols over Inheritance: Use typing.Protocol for structural typing (duck typing) when you only care that an object has certain methods, rather than inheriting from a specific base class.

Generics: Use TypeVar when writing functions that work on multiple types to preserve type information through the function call.

3. TypeScript Type Safety
   Configuration (tsconfig.json)

Mandatory Flags:

"strict": true

"noImplicitAny": true

"strictNullChecks": true (Prevents "undefined is not a function")

"exactOptionalPropertyTypes": true (Distinguishes between a missing key and a key explicitly set to undefined)

Rules

Unknown over Any: When the type is truly not known yet, use unknown. This forces you to perform a Type Guard check before using the variable.

Nominal Typing (Branded Types): Use "Branding" to prevent mixing up primitive types that represent different things (e.g., UserId string vs OrderId string).

Immutability: Prefer Readonly<T> or readonly properties for data that should not change after creation.
