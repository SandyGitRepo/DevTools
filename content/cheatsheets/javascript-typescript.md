---
title: JavaScript / TypeScript
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: ES2023 · TypeScript 5.9 · Node.js 22
tags: [language, frontend, node]
sources: [developer.mozilla.org, typescriptlang.org/docs]
---

Modern JavaScript plus the TypeScript you need day to day.

## Variables and destructuring

- `const` by default, `let` when reassigning, never `var`
- Destructure objects and arrays; give defaults inline
- Spread copies shallowly

```javascript
const { id, amount = 0, ...rest } = { id: 'LN-1', branch: 'Pune' };
const [first, , third] = ['a', 'b', 'c'];
const merged = { ...defaults, ...overrides };
const copy = [...list, 'new'];
```

## Optional chaining and nullish

- `?.` stops at `null`/`undefined` instead of throwing
- `??` falls back only for `null`/`undefined` (not `0` or `''`)
- `??=` assigns only when the value is nullish

```javascript
const city = customer?.address?.city ?? 'Unknown';
const limit = settings.limit ?? 50000;      // keeps 0 if set to 0
options.retries ??= 3;
```

## Arrays

- `map`/`filter`/`reduce` return new values; avoid mutating
- `at(-1)` reads from the end; `toSorted()` sorts without mutating (ES2023)
- `Object.groupBy` groups items (ES2024, Node 21+)

```javascript
const loans = [{ id: 'A', amount: 5 }, { id: 'B', amount: 15 }];
const big = loans.filter((l) => l.amount > 10).map((l) => l.id);
const total = loans.reduce((sum, l) => sum + l.amount, 0);
const last = loans.at(-1);
const sorted = loans.toSorted((a, b) => b.amount - a.amount);
```

## Async / await

- `await` only inside `async` functions (or top-level in ES modules)
- `Promise.all` runs in parallel and fails fast; `allSettled` waits for all
- Always handle errors — unhandled rejections crash Node

```javascript
async function loadStatement(id) {
  const res = await fetch(`/api/accounts/${id}/statement`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const [a, b] = await Promise.all([loadStatement('1'), loadStatement('2')]);
const results = await Promise.allSettled(ids.map(loadStatement));
```

## Modules

- ES modules: `import`/`export`; set `"type": "module"` in package.json for Node
- Dynamic `import()` loads code on demand
- Prefer named exports for better refactoring

```javascript
// money.js
export const toPaise = (rupees) => Math.round(rupees * 100);
export default function format(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
}

// app.js
import format, { toPaise } from './money.js';
const { heavy } = await import('./heavy.js');
```

## TypeScript types

- `interface` for object shapes; `type` for unions and compositions
- Union + literal types model states precisely
- `unknown` is the safe alternative to `any`

```typescript
interface Loan {
  id: string;
  amount: number;
  closedOn?: string;            // optional
  readonly branch: string;
}

type Status = 'ACTIVE' | 'CLOSED' | 'NPA';
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parse(input: unknown): Result<number> {
  return typeof input === 'number' ? { ok: true, value: input } : { ok: false, error: 'not a number' };
}
```

## Narrowing

- TypeScript narrows types after `typeof`, `in`, `instanceof` and equality checks
- Discriminated unions + `switch` give exhaustive checks
- `satisfies` checks a value against a type without widening it

```typescript
function label(r: Result<number>): string {
  if (r.ok) return `value ${r.value}`;
  return `error ${r.error}`;
}

function assertNever(x: never): never {
  throw new Error(`Unexpected ${x}`);
}

const colours = { primary: '#0072BC', accent: '#F37021' } satisfies Record<string, `#${string}`>;
```

## Utility types and generics

- `Partial`, `Required`, `Pick`, `Omit`, `Record` reshape types
- Generics keep functions type-safe for any input type
- `keyof` and indexed access types reuse existing shapes

```typescript
type LoanPatch = Partial<Pick<Loan, 'amount' | 'closedOn'>>;
type ByStatus = Record<Status, Loan[]>;

function groupBy<T, K extends PropertyKey>(items: T[], key: (t: T) => K): Record<K, T[]> {
  return items.reduce((acc, item) => {
    (acc[key(item)] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
```

## JSON

- `JSON.parse` throws on invalid input — wrap it in `try/catch`
- `JSON.stringify(value, null, 2)` pretty-prints
- Dates become strings; `BigInt` cannot be serialised by default

```json try
{
  "id": "LN-1",
  "amount": 500000,
  "tags": ["priority", "salaried"],
  "closedOn": null
}
```
