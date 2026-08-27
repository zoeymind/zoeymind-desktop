# Functional test-case rules

## Tree invariants

- Structure: root → module → nested module → test case → step.
- A module contains either child modules or test cases, never both.
- A test case contains steps, never child modules.
- Module rows use `# Name` in Tree Hashline Patch content.
- Case rows use `[P1]`, `[P2]`, or `[P3]`.
- Step rows use `Operation & Expected result`.

## Module design

For UI requirements, model the actual UI containment tree rather than feature categories:

1. Page or screen.
2. Region or composite component.
3. Individual interactive element.
4. Dialog, drawer, or page triggered by that element as its child.

Use one UI element per module. Name the element directly; avoid combined names such as “comment/like buttons” and vague feature buckets such as “interaction”. Put cross-cutting page behavior—loading, empty state, permission, opening, closing—in its own child module.

Typical depth is 2–4 module levels. More than 10 cases under one module is evidence that the UI element should usually be decomposed further.

## Case format

```text
[P1] Object-action & Precondition
```

Omit the precondition when none is needed.

- P1: core function and primary flow; target at least 40%.
- P2: boundaries, errors, negative paths, security; target about 40%.
- P3: UI detail and experience; target at most 20%.

A case verifies one behavior. Split cases that contain conditional branches.

## Step format

```text
Specific operation & Observable expected result
```

Each step performs one operation. State where the action occurs and the concrete data used. Expected results must be observable: state, text, navigation, persisted record, request outcome, or timed feedback. Avoid “works”, “succeeds”, “normal”, or “shows an error” without observable detail.

Elements that cause a request or state mutation must cover applicable network failure, timeout, duplicate trigger, and insufficient-permission paths. Avoid duplicating a behavior already covered at an owning parent module.
