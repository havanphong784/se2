# Project Workflow & Architecture Guidelines

## 1. Hierarchical Multi-Agent Task Delegation
- **Main Agent (Large-Context Model, e.g. nvidia/z-ai/glm-5.2)**:
  - Responsible for overall architecture, workflow management, complex state/backend logic, system integration, and final code verification.
  - Holds full conversation context; designs the main flow of the web app, then breaks it down and delegates bounded subtasks to specialized subagents.
- **Subagents (Small / Fast / Scoped Models, e.g. antigravity)**:
  - Delegate smaller, well-scoped, low-context tasks using the `Agent` tool with targeted context and appropriate model allocation:
    - UI component styling, layout tweaks, focused UI implementations.
    - Small helper functions, utility modules, mechanical edits (renames, type fixes, format-preserving tweaks).
  - Subagents focus on execution within their assigned scope without modifying high-level architecture.
- **Delegation flow**:
  1. Main agent reads the full codebase surface and designs the main web flow (routing, data layer, page composition).
  2. Main agent breaks work into bounded units (e.g. "Style `WeeklyReviewCalendar` grid", "Add `vnCalendarWeek` helper").
  3. Each unit is sent to a small-context subagent with only the context it needs — relevant file excerpts, the design tokens/contracts, and a crisp acceptance criteria — never the whole conversation.
  4. Subagent returns the localized change; main agent integrates, then runs `npm run build` + `npm test` for verification.

## 2. Verification & Git Policy
- **Testing & Build Verification**:
  - Always run `npm test` and `npm run build` to verify TypeScript types, Next.js build integrity, and unit test pass status before finalizing any task.
- **Git Push Policy**:
  - Commit locally when verified, but **NEVER auto-push** to remote branches unless explicitly instructed by the user.

## 3. Design System & UI Consistency
- Refer to `DESIGN.md` for full design system tokens, typography rules, color roles, component guidelines, and Do's/Don'ts.
- Key color tokens from `DESIGN.md`:
  - `Ecto Green` (`#58cc02` / `--color-ecto-green`): Main CTA fill, display headers, primary green accent.
  - `Lingot Lime` (`#a5ed6e` / `--color-lingot-lime`): Outlined actions, links, glowing border accents.
  - `Eel Light` (`#d7ffb8` / `--color-eel-light`): Pale green border/highlight & 3D button bottom border.
  - `Macaw Blue` (`#1cb0f6` / `--color-macaw-blue`): Secondary CTAs, alternative highlights.
  - `Eel Dark Blue` (`#042c60` / `--color-eel-dark-blue`): Main headings and key text emphasis.
  - `Ash` (`#777777` / `--color-ash`): Secondary text labels and subtle borders.
  - `Graphite` (`#3c3c3c` / `--color-graphite`): Dominant structural borders.
- Radius: Strictly 12px (`rounded-xl` / `12px`).
- No drop shadows; depth comes from solid 2-3px bottom borders (`border-b-4` pressable effect).
