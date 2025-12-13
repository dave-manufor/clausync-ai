Code Style Guidelines

1. General Principles
   Clarity over Cleverness: Code must be easy to read and understand. Favor verbose, descriptive variable names over abbreviations (e.g., use user_id instead of uid).

File Naming:

Python: Use snake_case (e.g., data_processor.py).

TypeScript: Use kebab-case for files (e.g., data-processor.ts) and PascalCase for React components (e.g., UserProfile.tsx).

2. Python Guidelines
   Style & Formatting

PEP 8 Compliance: Strictly adhere to PEP 8 standards.

Formatter: Code should be formatted to be compatible with Black.

Imports: Sort imports alphabetically within sections: Standard Library > Third Party > Local Application (Absolute imports preferred).

Type Safety

Strict Typing: Use Python type hints for all function arguments, return types, and class attributes.

Typing Library: Utilize typing.Optional, typing.List, etc., or standard collection types (Python 3.9+) to ensure clarity.

No Any: Avoid Any unless absolutely necessary; use Union or custom protocols if types are dynamic.

Documentation

Format: Use Google Style docstrings.

Requirement: Every function, class, and public module must have a docstring.

Content: Must include a description, Args: (with types), Returns: (with types), and Raises: (if applicable).

Example:

Python

def calculate_velocity(distance: float, time: float) -> float:
"""Calculates velocity based on distance and time.

    Args:
        distance (float): The distance traveled in meters.
        time (float): The time taken in seconds.

    Returns:
        float: The velocity in meters per second.

    Raises:
        ValueError: If time is zero or negative.
    """
    if time <= 0:
        raise ValueError("Time must be greater than zero.")
    return distance / time

3. TypeScript Guidelines
   Style & Formatting

Linter: Code must comply with standard ESLint configurations (e.g., Airbnb or Standard).

Formatter: Adhere to Prettier defaults (usually 2-space indentation, single quotes, semi-colons enabled).

Naming: Use camelCase for variables and functions. Use PascalCase for Classes, Interfaces, Types, and Enums.

Type Safety

Strict Mode: Assume strict: true in tsconfig.json.

No Implicit Any: Explicitly define types. Do not rely on implicit any.

Interfaces vs Types: Prefer interface for object definitions and type for unions/intersections or aliases.

Return Types: Explicitly declare function return types, even if void.

Documentation

Format: Use TSDoc (JSDoc style) standards.

Requirement: Top-level functions, classes, and complex interfaces must have comments.

Content: Use @param for arguments and @returns for output.

Example:

TypeScript

interface VelocityParams {
distance: number;
time: number;
}

/\*\*

- Calculates velocity based on distance and time.
- - @param params - An object containing distance and time.
- @returns The velocity in meters per second.
- @throws {Error} If time is zero or negative.
  \*/
  function calculateVelocity(params: VelocityParams): number {
  const { distance, time } = params;
  if (time <= 0) {
  throw new Error("Time must be greater than zero.");
  }
  return distance / time;
  }
