# QA Verification Checklist — Template

> Copy this template into every task assignment. The Team Leader fills in task-specific sections. The coding agent fills in results. The QA Review agent validates every item.
>
> **Auto-fill**: Section headers include `<!-- AUTO-FILL: roles -->` markers. The Team Leader uses these with [`QA-CHECKLIST-AUTO-FILL-RULES.md`](./QA-CHECKLIST-AUTO-FILL-RULES.md) to pre-select which sections to include based on the agent role. Include a section if the assigned agent's role appears in its marker. Remove sections whose markers don't match the role.

---

## Task Info

```
Task ID:          #___
Task Name:        ___
Agent:            ___
Workbranch:       work/<feature>/<task-slug>
Files Created:    ___
Files Modified:   ___
```

---

## Automated Checks (QA Agent runs these) <!-- AUTO-FILL: all -->

Adapt to the project's actual toolchain:

- [ ] Linting passes — zero violations
- [ ] Type checking passes — zero errors
- [ ] Tests pass — all passing (if tests exist for this domain)
- [ ] Build succeeds — compiles/bundles without errors

---

## Code Quality Checks

### Type Safety <!-- AUTO-FILL: schema, service, api, state, hook, component, router, database -->
- [ ] No unsafe type usage (`any`, unvalidated casts, etc.)
- [ ] No non-null assertions without justification
- [ ] Type-only imports used where applicable
- [ ] No unused variables or imports
- [ ] Strict boolean expressions (no implicit coercion)

### Code Structure <!-- AUTO-FILL: schema, service, api, state, hook, component, router, database, test -->
- [ ] Functions are reasonable length (no excessively long functions)
- [ ] No duplicated logic (repeated patterns extracted to helpers)
- [ ] No duplicated strings/magic values (extracted to constants)
- [ ] No commented-out code blocks
- [ ] No TODO/FIXME without issue reference
- [ ] Cognitive complexity is manageable

### Architecture <!-- AUTO-FILL: schema, service, api, state, hook, component, router, database, guardian -->
- [ ] Files in correct directories per project conventions
- [ ] Module boundaries respected (no forbidden imports)
- [ ] Public APIs properly exported (barrel/index files updated)
- [ ] No circular dependencies introduced
- [ ] Import direction rules followed

### Error Handling <!-- AUTO-FILL: service, api, hook, component, database -->
- [ ] External calls have appropriate error handling
- [ ] Error messages are descriptive
- [ ] Edge cases handled (null, empty, invalid input)
- [ ] Graceful degradation where appropriate

### Security <!-- AUTO-FILL: service, api, database -->
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] User input validated at boundaries
- [ ] No SQL injection, XSS, or command injection vectors
- [ ] Sensitive data not logged

---

## UI Checks (if applicable)

### Component Patterns <!-- AUTO-FILL: component, router -->
- [ ] Component follows project conventions (naming, structure, props)
- [ ] Proper loading states during async operations
- [ ] Proper error states when operations fail
- [ ] Proper empty states when no data
- [ ] Conditional rendering follows project style

### Accessibility <!-- AUTO-FILL: component -->
- [ ] Interactive elements have keyboard support
- [ ] Interactive elements have appropriate ARIA attributes
- [ ] Form inputs have labels
- [ ] Color contrast meets standards
- [ ] Focus management is correct

### Design System <!-- AUTO-FILL: component -->
- [ ] Uses project's design tokens / theme variables
- [ ] No hardcoded colors outside the design system
- [ ] Consistent spacing and typography
- [ ] Responsive behavior (if required)

---

## API / Data Checks (if applicable)

### API Contract <!-- AUTO-FILL: schema, api -->
- [ ] Request/response schemas defined and validated
- [ ] Endpoints follow project naming conventions
- [ ] Error responses are structured and consistent
- [ ] Authentication/authorization properly enforced

### State Management <!-- AUTO-FILL: state, hook -->
- [ ] Server data uses the appropriate data-fetching pattern
- [ ] Client-only state uses the appropriate state management
- [ ] Cache invalidation is correct
- [ ] No stale data scenarios

### Database (if applicable) <!-- AUTO-FILL: database -->
- [ ] Migrations are reversible
- [ ] Indexes exist for queried columns
- [ ] No N+1 query patterns
- [ ] Constraints enforce data integrity

---

## Feature-Specific Checks

> The Team Leader fills in checks specific to this task. Delete the examples and add real checks.

### Example: New API Endpoint
- [ ] Endpoint accepts expected input types
- [ ] Endpoint returns expected output types
- [ ] Endpoint handles invalid input gracefully
- [ ] Endpoint is documented (if API docs exist)
- [ ] Integration with existing endpoints is consistent

### Example: New UI Feature
- [ ] Feature renders with real data
- [ ] Feature works with empty/no data
- [ ] Feature handles loading states
- [ ] Feature handles error states
- [ ] Feature is navigable and discoverable

### Example: New Service/Module
- [ ] Module is properly initialized
- [ ] Dependencies are injected (not hardcoded)
- [ ] Module handles first-run / missing data scenario
- [ ] Module emits events for state changes (if event-driven)

---

## Documentation (QA Agent handles on PASS) <!-- AUTO-FILL: schema, service, api, state, hook, component, router, database, guardian -->

On PASS, the QA agent updates these docs on the workbranch:

- [ ] `{{ARCHITECTURE_FILE}}` updated if structural changes were made
- [ ] Other project docs updated if conventions/patterns changed
- [ ] New modules/services documented
- [ ] New APIs/endpoints documented
- [ ] Doc commits made on workbranch

---

## Verdict

```
QA RESULT:    PASS / FAIL
Issues Found: ___
Round:        ___ of 3
Reviewer:     ___
Timestamp:    ___
```
