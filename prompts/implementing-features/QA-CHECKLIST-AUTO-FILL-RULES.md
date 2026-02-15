# QA Checklist Auto-Fill Rules

> Maps agent roles to QA checklist sections. When the Team Leader creates a task, it uses this table to pre-select which QA sections apply, reducing boilerplate. The Team Leader only needs to add feature-specific checks manually.

---

## How It Works

1. Team Leader receives a task for a specific agent role
2. Team Leader looks up the role in the table below
3. Team Leader includes the marked sections in the QA checklist for that task
4. Team Leader adds any feature-specific checks manually
5. The QA reviewer validates all included sections

---

## Role → Section Mapping

| QA Section | Schema / Type | Service | API / Handler | State | Hook / Data | Component | Router | Database | Test | Guardian |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Automated Checks** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Type Safety** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| **Code Structure** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Architecture** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **Error Handling** | — | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | — | — |
| **Security** | — | ✓ | ✓ | — | — | — | — | ✓ | — | — |
| **UI: Components** | — | — | — | — | — | ✓ | ✓ | — | — | — |
| **UI: Accessibility** | — | — | — | — | — | ✓ | — | — | — | — |
| **UI: Design System** | — | — | — | — | — | ✓ | — | — | — | — |
| **API Contract** | ✓ | — | ✓ | — | — | — | — | — | — | — |
| **State Management** | — | — | — | ✓ | ✓ | — | — | — | — | — |
| **Database** | — | — | — | — | — | — | — | ✓ | — | — |
| **Documentation** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |

**Legend**:
- ✓ = Include this section in the QA checklist
- — = Omit this section (not relevant for this role)

---

## Section Details

### Always Included (All Roles)

**Automated Checks** — lint, typecheck, test, build. Every agent must pass these.

**Code Structure** — function length, duplication, commented-out code, TODOs. Every coding agent must meet structural standards.

### Role-Specific Sections

**Type Safety** — Included for all coding agents except test-engineer (tests may use loose types for mocking).

**Architecture** — Included for all coding agents. Verified by Guardian as the final gate.

**Error Handling** — Included for agents that write runtime code (services, API, hooks, components, database). Excluded for type-only or structural agents.

**Security** — Included for agents that handle user input or external data (services, API, database). Excluded for purely internal agents.

**UI sections** — Component Patterns, Accessibility, Design System. Only for UI-facing agents (component-engineer, router-engineer).

**API Contract** — For agents that define or consume API interfaces (schema, API/handler).

**State Management** — For agents managing application state (state-engineer, hook-engineer).

**Database** — Only for database-engineer (migrations, indexes, N+1, constraints).

---

## Usage in QA Checklist Template

The `QA-CHECKLIST-TEMPLATE.md` includes `<!-- AUTO-FILL: roles -->` markers on section headers. These markers tell the Team Leader which sections to include based on the agent role.

Example:
```markdown
## Type Safety <!-- AUTO-FILL: schema, service, api, state, hook, component, router, database -->
- [ ] No unsafe type usage
- [ ] ...
```

The Team Leader:
1. Copies the QA checklist template
2. Checks the `AUTO-FILL` markers against the assigned agent role
3. Keeps sections where the role is listed
4. Removes sections where the role is NOT listed
5. Adds feature-specific checks to the "Feature-Specific Checks" section

---

## Adding New Roles

When you create a new agent (see `CREATING-AGENTS.md`), add a column to the mapping table above:

1. Determine which QA sections are relevant to the new role
2. Add the column with ✓ or — for each section
3. Add the new role to the `AUTO-FILL` markers in `QA-CHECKLIST-TEMPLATE.md`

---

## Overriding Auto-Fill

The auto-fill is a starting point, not a constraint. The Team Leader may:

- **Add sections** not in the mapping (e.g., add Security to a component that handles auth)
- **Remove sections** from the mapping (e.g., skip Accessibility for an admin-only component)
- **Add custom checks** to the Feature-Specific section (always recommended)

The goal is to reduce boilerplate, not to enforce rigidity.
