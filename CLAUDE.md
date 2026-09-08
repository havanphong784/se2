# Project Workflow & Architecture Guidelines

## 1. Phân cấp Agent

- **Luôn chia nhỏ task** để phân các agent nhỏ khác thực hiện .
- **Model lớn** nắm flow chính & kiến trúc (routing, data layer, system integration, state/backend phức tạp).
- Model lớn **chia nhỏ task** → gửi **subagent** kèm **context tối thiểu** (chỉ file excerpt + design token + acceptance criteria, không gửi toàn bộ cuộc hội thoại).
- Subagent thực thi trong scope đóng, không sửa kiến trúc cao.
- Model lớn **tích hợp lại** kết quả subagent → verify build + test.

## 2. Kiểm tra & Git

- **Luôn chạy `npm test` + `npm run build`** verify TypeScript/Next.js/unit test trước khi hoàn tất task..

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
