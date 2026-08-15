# Project Workflow & Architecture Guidelines

## 1. Hierarchical Multi-Agent Task Delegation
- **Main Agent (Primary Large Model)**:
  - Responsible for overall architecture, workflow management, complex state/backend logic, system integration, and final code verification.
  - Controls task breakdown and delegates bounded subtasks to specialized subagents.
- **Subagents (Small / Fast / Scoped Models)**:
  - Delegate smaller, well-scoped tasks (e.g., UI component styling, layout tweaks, mechanical file edits, focused UI implementations) using the `Agent` tool with targeted context and appropriate model allocation.
  - Subagents focus on execution within their assigned scope without modifying high-level architecture.

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
