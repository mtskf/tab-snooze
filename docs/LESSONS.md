# Development Lessons

Key insights and patterns learned during development. Read this before starting any task.

- **Calendar Customization**: Shadcn UI's Calendar (based on `react-day-picker` v8) requires careful handling of `captionLayout`. To get dropdowns without breaking layout, you often need to provide a custom `Dropdown` component that wraps the native select (for functionality) with a styled visual layer (for consistency).
- **Native Select Overlay**: A reliable pattern for custom dropdowns is `relative container > absolute invisible select + pointers-none visual label`. This preserves accessibility and native behavior (keyboard nav, mobile picker) while matching custom design systems.