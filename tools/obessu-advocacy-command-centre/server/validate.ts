/** Small guardrails so a malformed or malicious request body can't blow up
 * memory/CPU on the local model (huge prompts are slow and easy to send by
 * accident from a buggy client). */

export class ValidationError extends Error {
  status = 400;
}

export function requireString(value: unknown, field: string, maxLen = 20000): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`"${field}" is required and must be a non-empty string.`);
  }
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

export function optionalString(value: unknown, maxLen = 20000): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError('Expected a string value.');
  }
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

export function requireObject(value: unknown, field: string): Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`"${field}" is required and must be an object.`);
  }
  return value as Record<string, any>;
}

export function optionalArray(value: unknown, field: string, maxItems = 50): any[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError(`"${field}" must be an array.`);
  }
  return value.slice(0, maxItems);
}
