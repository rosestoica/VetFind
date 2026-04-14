---
name: user-friendly-ui
description: Build polished, accessible, user-friendly React Native UI with proper loading states, error handling, responsive layouts, animations, and visual design. Use when creating screens, components, modals, forms, or any user-facing UI in this Expo/React Native project.
---

# User-Friendly UI

Guidelines for building polished, accessible UI in this Expo + React Native project.

## Tech Stack Reference

- **Framework**: React Native 0.81 + Expo SDK 54
- **Component library**: `react-native-paper` (Text, Button, Card, Divider, ActivityIndicator, etc.)
- **Icons**: `@expo/vector-icons` — prefer `MaterialCommunityIcons`, fallback to `Ionicons`
- **Theme**: Custom `useTheme()` hook from `src/hooks/useTheme` providing `colors`, `spacing`, `responsive`, `typography`, `styleHelpers`
- **Navigation**: `@react-navigation/stack`
- **Gradients**: `expo-linear-gradient`
- **Styling**: `StyleSheet.create()` — no inline style objects in render

## Core Principles

1. **Every async operation needs three states**: loading, error, success (+ empty)
2. **Touch targets minimum 44x44 points** — never smaller
3. **All text must use theme colors** — never hardcode color strings in components
4. **Responsive first** — use `responsive.getValue(phone, tablet, desktop)` for all size-dependent values
5. **Feedback on every interaction** — press states, loading indicators, success confirmations

## Existing Reusable Components

Always check and reuse these before building new ones:

| Component | Path | Purpose |
|-----------|------|---------|
| `LoadingState` | `src/components/LoadingState.tsx` | Skeleton loaders (card, list, appointment, compact) |
| `ErrorState` | `src/components/ErrorState.tsx` | Error display with retry button |
| `EmptyState` | `src/components/EmptyState.tsx` | Empty state with icon, title, subtitle, CTA |
| `ResponsiveLayout` | `src/components/ResponsiveLayout.tsx` | Responsive wrapper with maxWidth + padding |
| `BackHeader` | `src/components/BackHeader.tsx` | Consistent back navigation header |

## State Management Pattern

Every screen that fetches data must implement all four states:

```tsx
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// In render:
if (loading) return <LoadingState type="card" count={3} />;
if (error) return <ErrorState message={error} onRetry={fetchData} />;
if (!data || data.length === 0) {
  return (
    <EmptyState
      icon="magnify"
      title="Nothing here yet"
      subtitle="Helpful guidance on what to do next"
      ctaText="Take Action"
      onCtaPress={handleAction}
    />
  );
}
// ...render data
```

**Rules**:
- Never show a blank screen while loading — always use `<LoadingState>`
- Never show a raw error string — always use `<ErrorState>` with a human-readable message
- Never show an empty list without explanation — always use `<EmptyState>` with a CTA
- For inline loading (e.g. button submit), use `ActivityIndicator` from react-native-paper and disable the button

## Responsive Design

### Using the Theme

```tsx
const { colors, responsive, spacing, typography } = useTheme();
```

### Responsive Values

Use the three-breakpoint pattern for all dynamic sizes:

```tsx
fontSize: responsive.getValue(14, 16, 18)       // phone, tablet, desktop
padding: responsive.getValue(12, 16, 24)
iconSize: responsive.getValue(20, 24, 28)
```

### Layout Patterns

- Wrap screen content in `<ResponsiveLayout maxWidth={1200} centered>` on screens that benefit from constrained width on desktop
- Use `responsive.isDesktop` to switch between column/row layouts
- Use `responsive.cardColumns` for grid calculations
- Use `responsive.padding` and `responsive.gap` for consistent spacing
- For side-by-side inputs on wide screens: `responsive.shouldUseSideBySideInputs`

### ScrollView with Keyboard

For screens with forms, always use `KeyboardAvoidingView` with platform-aware behavior:

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    {/* form content */}
  </ScrollView>
</KeyboardAvoidingView>
```

## Accessibility

### Required for Every Interactive Element

- `accessibilityLabel` — describe what the element is (e.g. "Back button", "Open clinic details")
- `accessibilityRole` — "button", "link", "header", "image", etc.
- `accessibilityHint` — describe what happens on press (e.g. "Navigates to clinic page")

### Required for Dynamic Content

- `accessibilityLiveRegion="polite"` on content that updates (counters, status messages)
- `aria-busy={loading}` on containers while data loads

### Structure

- Use `accessibilityRole="header"` on screen titles and section headers
- Group related elements with `accessible={true}` on the parent and a combined `accessibilityLabel`
- Images: always set `accessibilityLabel` or `accessibilityElementsHidden={true}` for decorative images

### Touch Targets

```tsx
// Minimum 44x44 touch area even if visual element is smaller
<TouchableOpacity
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  accessibilityRole="button"
  accessibilityLabel="Close modal"
>
  <MaterialCommunityIcons name="close" size={24} />
</TouchableOpacity>
```

## Visual Design

### Color Usage

Always use theme tokens — never hardcode hex values in components:

```tsx
const { colors } = useTheme();

// Primary actions → colors.primary.main (#2563eb blue)
// Accent/secondary CTA → colors.accent.main (#ea580c terracotta)
// Backgrounds → colors.surface.background, colors.surface.card
// Text → colors.text.primary, colors.text.secondary, colors.text.disabled
// Borders → colors.neutral[200]
// Errors → colors.error.main
// Success → colors.success.main
```

### Spacing Scale

Use `theme.spacing` values or `responsive.getValue()` — never arbitrary pixel numbers. Keep spacing consistent: 4, 8, 12, 16, 20, 24, 32, 40, 48.

### Typography

- Use `<Text>` from `react-native-paper` for all text
- Apply `typography` styles from theme for headings
- Font weights: 400 (body), 500 (medium/labels), 600 (semibold/emphasis), 700 (bold/titles)

### Shadows and Elevation

Use `styleHelpers.card()` or `theme.shadows` for consistent elevation — never write manual shadow values.

### Border Radius

Use `theme.borderRadius` or `responsive.adaptiveBorderRadius` — the project standard is 12-16px for cards and buttons.

## Loading & Transition States

### Button Loading

```tsx
<Button
  mode="contained"
  onPress={handleSubmit}
  loading={submitting}
  disabled={submitting || !isValid}
  buttonColor={colors.primary.main}
>
  {submitting ? 'Saving...' : 'Save'}
</Button>
```

### Optimistic Updates

For actions where instant feedback matters (favorites, toggles):
1. Update UI immediately
2. Fire API call in background
3. Revert on failure with a toast/snackbar

### Pull to Refresh

For list screens, always add pull-to-refresh:

```tsx
<FlatList
  refreshing={refreshing}
  onRefresh={handleRefresh}
  // ...
/>
```

## Navigation & Information Architecture

### Screen Structure

Every screen follows this structure:

```
SafeAreaView
├── StatusBar
├── Header (BackHeader or custom)
├── Content (ScrollView / FlatList / static)
└── Footer (sticky CTA if applicable)
```

### Transitions

- Use stack navigation default slide transitions
- For modals, use `presentation: 'modal'` in screen options
- Avoid jarring layout jumps — use `Animated` or `LayoutAnimation` for appearing/disappearing content

### Deep Links

When a screen can be reached via deep link, handle the case where data is passed via params OR needs to be fetched. Never assume navigation params will always be present.

## Forms

### Validation

- Validate on blur for individual fields, validate all on submit
- Show errors inline below the field, not as alerts
- Use `colors.error.main` for error text and border
- Disable submit until required fields are filled

### Input UX

- Auto-focus the first input on screen mount (unless it would open keyboard annoyingly on mobile)
- Show character counts for text areas with limits
- Use appropriate `keyboardType`: "email-address", "phone-pad", "numeric", etc.
- Use `returnKeyType` to chain inputs: "next" to move to next field, "done" on last field
- Use `textContentType` / `autoComplete` for autofill (email, password, name, phone)

## Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|------------|
| Hardcode hex colors | Use `colors.*` from `useTheme()` |
| Inline style objects in render | Extract to `StyleSheet.create()` |
| Raw `console.error` on API failure | Show `<ErrorState>` with human message |
| Blank screen while loading | Show `<LoadingState>` skeleton |
| Alert() for confirmations | Use a modal or in-context confirmation |
| Nested ScrollViews | Use a single FlatList with `ListHeaderComponent` / `ListFooterComponent` |
| Text without Paper `<Text>` | Always use `import { Text } from 'react-native-paper'` |
| Fixed pixel sizes everywhere | Use `responsive.getValue()` for adaptive sizing |
| Unhandled empty arrays | Show `<EmptyState>` with helpful CTA |
| TouchableOpacity without a11y | Always add `accessibilityLabel` + `accessibilityRole` |

## Checklist

Before considering a screen or component complete, verify:

- [ ] Loading state shown (skeleton, not spinner — unless inline)
- [ ] Error state with retry
- [ ] Empty state with CTA
- [ ] All text uses theme colors
- [ ] Responsive on phone, tablet, and desktop
- [ ] All interactive elements have accessibility labels
- [ ] Touch targets >= 44x44
- [ ] No hardcoded colors or pixel values
- [ ] Keyboard handling for forms
- [ ] Pull-to-refresh on lists
