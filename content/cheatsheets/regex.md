---
title: Regex
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: ECMAScript 2023 (JavaScript)
tags: [regex, validation, text]
sources: [developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_expressions]
---

Regular expressions in JavaScript syntax. **Try it** opens the pattern in the Regex Tester.

## Basics

- `.` any character except newline; `\d` digit; `\w` word character; `\s` whitespace
- Upper-case versions negate: `\D`, `\W`, `\S`
- Escape special characters with `\`: `. * + ? ( ) [ ] { } | ^ $ \`

```regex try
/\d{3}-\d{4}/g
```

## Quantifiers

- `*` zero or more, `+` one or more, `?` optional
- `{n}`, `{n,}`, `{n,m}` for exact counts and ranges
- Add `?` to make them lazy: `.*?` matches as little as possible

```regex try
/<b>.*?<\/b>/g
```

## Anchors and boundaries

- `^` and `$` match start and end (of each line with the `m` flag)
- `\b` is a word boundary — stops partial matches
- Without anchors, a pattern can match inside a longer string

```regex try
/^\d{6}$/gm
```

## Groups and alternation

- `( … )` captures; `(?: … )` groups without capturing
- `(?<name> … )` names a group; refer to it as `$<name>` in replacements
- `a|b` matches either side

```regex try
/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/g
```

## Lookarounds

- `(?=x)` followed by x; `(?!x)` not followed by x
- `(?<=x)` preceded by x; `(?<!x)` not preceded by x
- They check context without consuming characters

```regex try
/(?<=₹\s?)[\d,]+(\.\d{2})?/g
```

## Indian formats

- PAN: 5 letters, 4 digits, 1 letter (4th letter is holder type)
- PIN code: 6 digits, first digit 1–8
- Mobile: 10 digits starting 6–9, optional +91

```regex try
/\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g
```

## Common validations

- IFSC: 4 letters, `0`, then 6 alphanumerics
- Email: keep it simple — the real check is sending a confirmation
- GSTIN: 2-digit state code + PAN + entity number + `Z` + checksum

```regex try
/^[A-Z]{4}0[A-Z0-9]{6}$/
```

## Flags

- `g` all matches · `i` ignore case · `m` multiline anchors
- `s` lets `.` match newlines · `u` full Unicode · `y` sticky
- `d` adds start/end indices for groups

```regex try
/^error:.*$/gim
```

## Performance and safety

- Avoid nested quantifiers like `(a+)+` or `(.*)*` — they can take exponential time (ReDoS)
- Anchor patterns and prefer specific classes (`[^,]*`) over `.*`
- Validate input length before running a regex on user data

```regex try
/^[^,]*,[^,]*$/
```
