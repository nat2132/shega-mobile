# Shega Mobile — Complete Application Audit Report

> **Audit Date:** July 21, 2026
> **App Version:** 1.0.0 (Expo SDK 57 / RN 0.86)
> **Scope:** Full-stack review — 30,000+ lines across 150+ files
> **Methodology:** Line-by-line code analysis of every screen, component, service, hook, context, utility, database query, and configuration file

---

## Executive Summary

Shega Mobile is a well-architected business management app for Ethiopian SMBs with impressive depth: inventory, sales, expenses, budgets, contacts, orders, adjustments, debt tracking, multi-warehouse, subscriptions, notifications, PDF export, CSV import/export, universal search, business health scoring, and AI-style business assistant. The codebase shows strong engineering discipline in many areas (consistent theme system, language-aware typography, reusable components, tutorial framework), but suffers from critical security vulnerabilities, data integrity issues, and maintainability problems that must be addressed before production release.

**Overall Score: 5.5/10** (down from 6.5 after deeper analysis revealed critical security and data integrity issues)

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
| UX | 5/10 | Modal depth, missing loading states, inconsistent confirmations, 5 onboarding screens |
| UI | 7/10 | Strong design system, some hardcoded colors, legacy Animated API, inaccessible confetti |
| Features | 7.5/10 | Comprehensive but missing cloud backup, barcode scanning, receipt OCR, bulk operations |
| Security | 2/10 | **SQL injection 30+ places**, **price in URL params (subscription)**, **no route guards**, **no session management** |
| Performance | 5/10 | Fat context (9,767 lines), massive 4k+ line files, confetti particle remount bug |
| Business Logic | 4/10 | **No transactions anywhere**, **Ethiopian calendar leap year bug**, **VAT applied pre-discount**, non-atomic operations |
| Productivity | 4/10 | Missing bulk actions, batch operations, no barcode scanning, no quick-inline-edit |
| Accessibility | 2/10 | Pervasive missing roles/labels, no focus management in modals, inaccessible swipe-to-delete |
| Code Quality | 4/10 | Massive 4k+ line files, duplicate logic, `any` types, typos, dead code, stale closures |

---

## BUGS FOUND (By Severity)

### CRITICAL Bugs

| # | Bug | File | Detail |
|---|-----|------|--------|
| B1 | **SQL Injection (30+ occurrences)** | `src/database/db.ts` throughout | `execSync(\`...${userInput}...\`)` used for all UPDATE/DELETE instead of parameterized queries. User-controlled `reason`, `itemCondition`, `unitType`, `statusFilter`, `date` interpolated. **Full DB compromise possible.** |
| B2 | **Sale form always receives empty cart** | `app/sale-form.tsx:5` | `cart={[]}` hardcoded. The sale form is **permanently broken** — no items ever in cart, subtotal always 0, checkout always fails. This file is inaccessible from the app but exists as a route. |
| B3 | **Subscription price in URL params — no server validation** | `app/subscription/plans.tsx:14`, `app/subscription/payment.tsx:15` | `price` passed via URL search params. User can edit URL to pay any amount. `SubscriptionContext.selectPlan()` accepts caller-supplied price with zero validation. `updateSubscriptionPlan()` stores whatever price is sent. |
| B4 | **No database transactions anywhere** | `src/database/db.ts` throughout | Every multi-step operation (insert sale + update inventory, process return, convert order, pay debt) runs outside a transaction. A crash mid-operation leaves permanent data inconsistency. **Inventory drift guaranteed over time.** |
| B5 | **No route authentication guards** | `app/(tabs)/_layout.tsx` | Any deep link or direct URL navigation bypasses PIN screen entirely. No middleware, no guard layout. |
| B6 | **No session management / background re-lock** | `app/verify-pin.tsx`, entire app | Once PIN is entered, app never re-locks. No `AppState` listener. No inactivity timeout. Anyone who picks up an unlocked device has full access. |
| B7 | **PIN lockout bypassed by app restart** | `app/verify-pin.tsx` | `attempts` and `lockoutTimer` are React state (in-memory). Kill and restart the app = 0 attempts. Attacker can try unlimited PINs. |
| B8 | **Ethiopian calendar leap year bug** | `src/utils/date-utils.ts:107` | `fromEthiopianToDate` uses `Math.floor(year / 4)` instead of `Math.floor((year - 1) / 4)`. **All dates in Ethiopian leap years are off by 1 day.** |
| B9 | **Ethiopian calendar leap year detection bug** | `src/utils/date-utils.ts:35` | `(year + 1) % 4 === 0` is incorrect. Should be `year % 4 === 0` for 1-indexed years. Compound with B8, dates in Pagumen of leap years are wrong. |
| B10 | **Pack insert not awaited** | `src/screens/inventory/inventroy-form.tsx:754` | `insertPack` called in a loop with NO `await`. The function returns before packs are created. Packs are created asynchronously and may never complete if the component unmounts. |
| B11 | **VAT calculated on pre-discount subtotal** | `src/utils/pdf-utils.ts:328` | `grandTotal = subtotal - discount + (subtotal * vat) / 100`. Most tax regimes require VAT on the discounted amount. |

### HIGH Bugs

| # | Bug | File | Detail |
|---|-----|------|--------|
| B12 | **`sale-form.tsx` route exists but is broken** | `app/sale-form.tsx` | No `onFinish` or `onBack` callbacks provided. Cart is hardcoded empty. Navigation after form completion is undefined. |
| B13 | **`onRequestClose` missing on Modal** | `src/screens/settings/warehouse-selector.tsx` | Android hardware back button has no handler. RN Modal without `onRequestClose` can cause unresponsive UI on Android. |
| B14 | **`onComplete()` fires even if DB write fails** | `src/screens/settings/warehouse-selector.tsx:215` | `insertWarehouse` return value unchecked. `setActiveWarehouseId` called regardless of success. User sees success but data not saved. |
| B15 | **Missing `React` imports in 5 route files** | `app/welcome-choice.tsx`, `app/inventory-onboarding.tsx`, `app/sales-onboarding.tsx`, `app/message.tsx` | These files use JSX but don't import React. Will crash if project doesn't use automatic JSX transform. |
| B16 | **`showToast` argument type mismatch** | `app/reports.tsx:306` | Called as `showToast(t('...'), 'error')` (two args) vs correct `showToast({title, message, type})` pattern used elsewhere. Toast silently fails. |
| B17 | **`CustomTabBar` dead code (`isFocused \|\| true`)** | `src/components/CustomTabBar.tsx` | `\|\| true` makes condition always true. Tab label fallback via `options.tabBarLabel`/`options.title` is unreachable. |
| B18 | **`SwipeableItem` stale closure** | `src/components/SwipeableItem.tsx` | `PanResponder` created once via `useRef` captures initial `onDelete`/`dialog`. After re-render with updated callbacks, swipe handler uses stale references. **Deletes wrong record.** |
| B19 | **`user_version` PRAGMA overwritten with budget amount** | `src/database/db.ts:4014` | `execSync(\`PRAGMA user_version = ${amount}\`)` stores budget in SQLite schema version. **Blocks all future schema migrations.** |
| B20 | **Subscription feature gate ignores `feature` parameter** | `src/database/db.ts` (via `isPremiumFeatureUnlocked`) | All premium features unlock together. Per-feature gating doesn't work. If per-feature purchasing is ever added, the entire system must be redesigned. |
| B21 | **Hardcoded Telebirr number is placeholder** | `src/screens/subscription/subscription-payment.tsx` | `telebirrNumber = 'XXXXXXX'`. Payment screen is **non-functional in production** without a real account number. |
| B22 | **No `await` on DB write in warehouse handlers** | `src/screens/settings/warehouse.tsx` | `handleSave` calls `updateWarehouse` without `await`, then immediately calls `refreshWarehouses()` reading stale data. Race condition. |
| B23 | **Duplicate back buttons in translation screen** | `app/translation.tsx` | Custom `headerLeft` with `ChevronLeft` but no `headerBackVisible: false`. Expo Router also renders default back button. Double back buttons. |
| B24 | **CSV export missing `adjustments` module** | `src/screens/settings/csv-manager.tsx:233` | `switch` on module key doesn't handle `'adjustments'`. Falls through with empty array. Exports 0 records silently. |
| B25 | **PIN validation doesn't trim whitespace** | `src/screens/settings/security.tsx:48` | Inputs not trimmed. If user types " 1234" (leading space), `Number(" 1234")` = 1234 (passes) but stored PIN has leading space. Authentication fails later. |

### MEDIUM Bugs

| # | Bug | File | Detail |
|---|-----|------|--------|
| B26 | **Confetti particle remount on every render** | `BusinessSuccessModal.tsx`, `SaleSuccessModal.tsx` | `ConfettiParticle` defined inside parent component. 40 particles unmount/remount every render. Performance hit + visual jitter from `Math.random()`. |
| B27 | **Date object mutation in `getDateRange()`** | `app/reports.tsx:178,184` | `const today = new Date()` then `today.setHours(0,0,0,0)` — mutates a `const` Date object. Side-effect bug. |
| B28 | **`processReturn` manual SQL escaping insufficient** | `src/database/db.ts:4828` | `saleData?.customerName?.replace(/'/g, "''")` — only escapes single quotes. Doesn't protect against backslash, Unicode, or SQLite-injection vectors. |
| B29 | **`EXISTS (SELECT 1 FROM ...)` used for validation throughout** | `src/database/db.ts` throughout | Subquery-based validation instead of application-layer checks. Works but couples validation to DB structure. |
| B30 | **User profile completion flag set BEFORE PIN creation** | `src/screens/account creation/user-setup.tsx` | `user_setupComplete = 'true'` stored before PIN is created. If user exits during PIN setup, they return to dashboard with no PIN. |
| B31 | **Recovery code regenerated on every mount** | `app/recovery-code.tsx` | `useEffect` generates new code on mount. Navigating away and back invalidates previously displayed code. |
| B32 | **`purchase_orders` referenced in subscription but not implemented** | `SubscriptionContext.tsx` | `PremiumFeature` type includes `purchase_orders` but the app has no purchase order functionality. Feature gate leads to a dead end. |
| B33 | **Warehouse selector form omits contact/phone/notes fields** | `src/screens/settings/warehouse-selector.tsx` | Full warehouse form (in settings) has 5 fields, quick-create modal only has 2 (name, location). Inconsistent. |
| B34 | **Profit margin shown as NaN%** | `src/screens/inventory/item-details.tsx` | When both `basePurchasePrice` and `baseSellingPrice` are 0, `profit` is 0, `margin` = `0/0 = NaN`. Display shows "NaN%". |
| B35 | **Hundreds of pack inserts sequentially** | `src/screens/inventory/inventroy-form.tsx:754` | `for (let i = 1; i <= Number(totalPackQuantity); i++) { insertPack(...) }`. For 1000 packs, 1000 sequential DB inserts. Should use batch insert. |
| B36 | **Sales detail screen doesn't refresh after delete** | `src/screens/inventory/item-details.tsx` | `handleDelete` calls `onClose` which navigates back, but the list screen doesn't reload (no `useFocusEffect`). Stale data displayed. |
| B37 | **Order detail dates use `toLocaleString()` ignoring calendar setting** | `src/screens/orders/order-detail.tsx:269` | All date displays use raw `toLocaleString()` instead of the app's `formatDate()`. Ethiopian calendar users see wrong dates. |
| B38 | **String `"0"` stored for `editedAt` in legacy sales** | `src/database/db.ts` migration | `ALTER TABLE sales ADD COLUMN employeeId TEXT DEFAULT '0'` — default is `'0'` (string) not `0` (number). Inconsistent typing. |

### LOW Bugs

| # | Bug | File | Detail |
|---|-----|------|--------|
| B39 | `Number("")` returns 0 — PIN validation edge case | `security.tsx` | Empty string passes numeric check. But length check (4 chars) prevents this. Acceptable but fragile. |
| B40 | No `accessibilityElementsHidden` on decorative elements | All components with glow/confetti | Decorative elements accessible to screen readers. Noisy experience. |
| B41 | `/* eslint-disable-next-line react-hooks/exhaustive-deps */` in 5+ places | Multiple files | Suppressed lint warnings that may hide real bugs. |
| B42 | `Math.random()` used for layout values in confetti | `BusinessSuccessModal.tsx`, `SaleSuccessModal.tsx` | Causes visual jitter between renders. Seed should be stable. |
| B43 | `categoryName?.toLowerCase()` translation lookup fragile | `RecentItemCard.tsx` | Complex fallback chain for category name translation. Could produce untranslated strings. |
| B44 | `user_pin` legacy key never cleaned on reset | `app/index.tsx`, `src/screens/settings/settings.tsx` | SecureStore reset omits `user_pin`. Old builds' plaintext PIN survives factory reset. |
| B45 | Emoji encoding corrupted in `calendar.tsx` | `src/screens/settings/calendar.tsx:70` | Calendar emoji bytes appear garbled (`ðŸ"…`) instead of `📅`. |
| B46 | Oromo word `kubbaa` means "ball", not "pcs" | `src/utils/pdf-translations.ts` | Translation for "pcs" in Oromo is `kubbaa` which means "ball" in Afaan Oromo. Incorrect. |

---

## CRITICAL Security Issues

### SQL Injection (30+ occurrences)
**File:** `src/database/db.ts` throughout | **Severity: CRITICAL**

Every UPDATE/DELETE statement uses `execSync()` with string interpolation. Examples:
- `processReturn()`: `VALUES (${data.itemId}, ... 'Returned: ${data.itemCondition} - ${data.reason}')` — user-controlled `reason`, `itemCondition`
- `getOrders()`: `WHERE s.paymentStatus = '${statusFilter}'` — user-controlled `statusFilter`
- `getActivityFeed()`: `WHERE date(s.createdAt) = '${options.date}'` — user-controlled `date`
- All inventory UPDATEs: `UPDATE items SET baseSellingPrice = ${adj.newValue} WHERE id = ${adj.itemId}`

**Fix:** Replace ALL `execSync(\`...${}...\`)` with `runSync(\`...?...\`, [params])`.

### Subscription Price Tampering
**Files:** `app/subscription/plans.tsx`, `app/subscription/payment.tsx`, `SubscriptionContext.tsx`

The price is passed through URL search params: `router.push('/subscription/payment?plan=premium&durationMonths=1&price=2499')`. A user can manually change the URL to `?price=1`. `SubscriptionContext.selectPlan()` and `updateSubscriptionPlan()` accept caller-supplied price with zero validation.

**Fix:** Add server-side price validation or at minimum client-side verification against a hardcoded price table before writing to DB.

### No Route Guards / No Session Management
**Files:** `app/(tabs)/_layout.tsx`, `app/verify-pin.tsx`

Zero auth checks on any route. No session management — once PIN is entered, the app never re-locks. No `AppState` listener. No inactivity timeout.

**Fix:** Create a root layout guard. Add `AppState` listener for background re-lock. Persist attempt counter in SecureStore.

### Legacy Plaintext PIN Migration
**File:** `src/services/crypto.ts:38-43`

`verifyPinHash` falls back to reading `settings_pin` as plaintext if it's a 4-digit string. Old builds stored PIN in plaintext. Residual plaintext PINs may exist.

---

## HIGH Security Issues

| # | Issue | File | Detail |
|---|-------|------|--------|
| S1 | No KDF for PIN hashing | `crypto.ts` | SHA256(salt+pin) instead of PBKDF2/bcrypt/Argon2 |
| S2 | No biometric-protected SecureStore keys | `biometrics.ts` | `requireAuthentication` option not used for sensitive keys |
| S3 | Weak PIN blacklist | `create-pin.tsx` | Only 11 PINs blocked. Allows `0000`, `1111`, `2222`, `2580`, birth years |
| S4 | No data validation on financial operations | `database/db.ts` | Negative quantities, zero prices, over-payments accepted |
| S5 | No backup/export capability | Entire app | Any data loss is permanent |
| S6 | Payment is honor-based Telebirr manual entry | `subscription-payment.tsx` | No real-time payment verification API |
| S7 | `any[]` types for payments/renewals/auditLog | `SubscriptionContext.tsx` | No type safety in payment history pipeline |
| S8 | Duplicate pricing in two files | `subscription-plans.tsx`, `manage.tsx` | Prices must be updated in two places |

---

## CRITICAL Data Integrity Issues

### No Transactions — Every Multi-Step Operation Can Corrupt Data
**File:** `src/database/db.ts` throughout | **Severity: CRITICAL**

Zero `BEGIN`/`COMMIT`/`ROLLBACK` blocks. Every paired operation (insert+update, update+delete) can partially fail:

| Function | Operations | Crash Scenario |
|----------|-----------|----------------|
| `insertSale` | INSERT sale, UPDATE inventory | Sale recorded, inventory NOT deducted |
| `insertAdjustment` | INSERT adj, UPDATE prices | Adjustment logged, price NOT changed |
| `processReturn` | Validate, INSERT return, UPDATE qty, INSERT adjustment | Partial return with inconsistent inventory |
| `convertOrderToSale` | UPDATE status, UPDATE inventory | Order converted, inventory not deducted |
| `processDebtPayment` | Multiple UPDATEs, INSERT debt_payments | Customer marked paid, money not recorded |
| `deleteBudget` | Clear categories, adjustments, expenses, DELETE budget | Orphaned references on crash |

**Fix:** Wrap every multi-statement function in `execSync('BEGIN')` / `execSync('COMMIT')` / `execSync('ROLLBACK')`.

### Foreign Keys Not Consistently Enabled
**File:** `src/database/db.ts`

`PRAGMA foreign_keys` is not set at connection initialization. If SQLite defaults to OFF (which it does), all foreign key constraints are silently unenforced.

---

## CRITICAL UX Issues

### 5 Onboarding Screens Before App Access
**Flow:** first-onboarding → welcome-choice → inventory-onboarding → sales-onboarding → analytics-onboarding → user-setup → pin-setup → create-pin → recovery-code → message → subscription/welcome

**Problem:** 11 screens before dashboard. Users must complete 4 onboarding screens (inventory, sales, analytics) they don't understand yet because they haven't used the app.

**Fix:** Reduce to 3: Welcome → Business Setup (name, PIN) → Dashboard. Show feature onboarding contextually within the app.

### Sale Form Route is Broken
**File:** `app/sale-form.tsx`

This route passes `cart={[]}` (always empty) and provides no `onFinish` or `onBack` callbacks. The entire sale form is broken when accessed via this route. Either remove the route or wire it properly to navigation state/context.

### Modal Stack Depth
Dashboard and sales-hub allow 5+ levels of stacked modals (search → item detail → sale form → success → share). No visual breadcrumbs, no way to see where you are in the stack.

### Missing Loading States on Almost Every Screen
Only contacts screen uses the `Skeleton` component. Other screens show nothing, stale data, or blank areas while loading. The app has an excellent skeleton component library — it's just not used.

### Missing Empty States
- Orders: "No orders found" text only
- Inventory: "No items found" text only
- Budgets: "No budgets yet" text only
- Many screens have no empty state at all

---

## HIGH UX Issues

| # | Issue | Detail |
|---|-------|--------|
| UX1 | No pull-to-refresh on contacts/orders | User must navigate away and back to refresh |
| UX2 | No back-navigation from PIN screen | If user lands on PIN screen accidentally, can't go back without killing app |
| UX3 | No confirmation on destructive actions | Some have confirmations, some don't (inconsistent) |
| UX4 | FAB position conflicts with tab bar | All FABs use `bottom: 120` — overlaps with different tab bar heights |
| UX5 | No "undo" toast after sale/delete | Sale recorded or item deleted — no undo option |
| UX6 | No haptic preference setting | Sound is toggleable, haptics are not |
| UX7 | No search/filter in orders tab | Can't find specific orders |
| UX8 | Subscription welcome goes to dashboard, not plans | Users who want to subscribe must find settings or hit a paywall first |
| UX9 | No "Compare Features" matrix on plans screen | Only management screen has it |
| UX10 | Restore Purchases is misnamed | Just refreshes local state, not an App Store/Play Store restoration |

---

## UI AUDIT

### Design System Strength: 7/10

**Strengths:**
- 7 color themes (light, dark, midnight, emerald, charcoal, slate, cocoa)
- Excellent language-aware typography via `AppText` with Ge'ez script support
- Consistent glass-morphism design language
- `Spacing` and `BorderRadius` constants used throughout
- `AppNumber` with locale-aware formatting

**Weaknesses:**

| Component | Issue | Fix |
|-----------|-------|-----|
| AppButton | Missing `accessibilityRole="button"`, no `accessibilityState` | Add accessibility props |
| BottomSheet | Close button too small (34px vs 44px min), no focus trap | Enlarge, add focus management |
| CustomDialog | No `accessibilityRole="alert"`, no focus trap, buttons unlabeled | Add alert role + focus trap |
| GlobalHeader | **Zero accessibility labels on any of 3 icon buttons** | Add `accessibilityLabel` to all |
| NotificationBell | Badge count not in accessibility label | Include "unread" count in label |
| SwipeableItem | Legacy `PanResponder` (stale closure, no gesture-handler) | Migrate to `react-native-gesture-handler` Swipeable |
| UniversalSearch | Clear button invisible on dark backgrounds | Use theme-aware colors |
| Skeleton | Hardcoded light/dark colors, `isDark` detection fragile | Use theme colors, luminance-based detection |
| ErrorBoundary | Hardcoded English, raw error messages, no retry button | Translate, sanitize, add retry |
| Confetti components | `ConfettiParticle` defined inside parent (40 particles remount every render) | Move to separate file, memoize |

### Accessibility Score: 2/10

**Pervasive Issues Across ALL Components:**
- No `accessibilityRole` on interactive elements (buttons, links, tabs, list items)
- No `accessibilityLabel` on icon-only buttons
- No `accessibilityState` (disabled, selected) on interactive elements
- No focus management in modals or bottom sheets
- No `accessibilityHint` on complex interactions
- Decorative elements (glow, confetti, icons) not hidden from screen readers
- `toUpperCase()` on text assumes Latin script (breaks for Amharic/Oromo/Tigrinya)
- Color-only status indicators (stock, priority) with no text alternatives
- No `prefers-reduced-motion` support for animations

**WCAG Score Estimates:**
| Principle | Score | Key Gaps |
|-----------|-------|----------|
| Perceivable | 3/10 | Color contrast, no alt texts |
| Operable | 2/10 | No keyboard nav, no focus indicators, swipe-only actions |
| Understandable | 4/10 | Consistent nav but labels missing |
| Robust | 2/10 | Screen reader compatibility poor |

---

## FEATURE AUDIT

### Strengths (Done Well)
- Universal Search across 8 entity types
- Notification system with 15+ check types (low stock, debts, expiring items, budgets, etc.)
- Business Assistant with prioritized insights
- Business Health Score (8-factor weighted scoring)
- Multi-warehouse support
- Tutorial overlay system
- Form draft auto-save/restore
- Multi-language PDF export (receipts, invoices, reports)
- Ethiopian & Gregorian calendar support
- Biometric authentication
- Recovery code for PIN reset
- CSV import with column mapping validation

### Missing Features (Competitive Gaps)

| Feature | Competitors | Value |
|---------|-------------|-------|
| Cloud sync / backup | All major apps | CRITICAL |
| Barcode scanning | Square, Shopify | HIGH |
| Receipt scanning (OCR) | Expensify, Zoho | MEDIUM |
| Multi-user / role-based access | QuickBooks, Wave | HIGH |
| Bank transaction import | Wave, Xero | MEDIUM |
| Automated report scheduling | All major | MEDIUM |
| WhatsApp integration (beyond stubs) | Local competitors | HIGH |
| Inventory barcode label printing | Most POS | MEDIUM |
| Customer portal / debtor self-service | FreshBooks | LOW |
| Multi-currency | Xero, QuickBooks | MEDIUM |
| Tax auto-calculation (VAT/TOT) | Most POS | MEDIUM |
| Offline-first / PWA | Local-first but no offline indicator | LOW |

### Quick Wins (Low Effort, High Value)

| Feature | Effort | Value |
|---------|--------|-------|
| Pull-to-refresh on all lists | 1 day | HIGH |
| Loading skeletons everywhere | 2 days | HIGH |
| Confirmation on all destructive actions | 1 day | HIGH |
| Empty state CTAs on all screens | 1 day | MEDIUM |
| Search/filter in orders tab | 1 day | MEDIUM |
| Undo toast after sale/delete | 2 days | HIGH |
| Quick-add customer during sale | 1 day | HIGH |
| Recent items search auto-complete | 1 day | HIGH |

---

## PERFORMANCE AUDIT

### Rendering Performance

| Issue | File | Impact | Fix |
|-------|------|--------|-----|
| **Fat Settings context (9,767 lines)** | `SettingsContext.tsx` | HIGH — all consumers re-render on ANY setting change | Split into 3 contexts or adopt Zustand |
| **Monolithic files** | `sales.tsx` (4,158), `dashboard.tsx` (1,637), `settings.tsx` (1,092) | HIGH — everything re-renders on any state change | Decompose into sub-components |
| **`t()` not memoized** | `SettingsContext.tsx` | MEDIUM — new reference every render | Add `useCallback` |
| **Confetti particle remount bug** | `BusinessSuccessModal.tsx`, `SaleSuccessModal.tsx` | MEDIUM — 40 particles unmount/remount on every render | Extract to separate memoized file |
| **Module-level mutable state** | `expense.tsx` (`_tooltipCtx`), `orders.tsx` (`statusColors`) | MEDIUM — stale values after theme change | Move to component-level or `useMemo` |
| **No `React.memo` on `BottomSheet`, `CustomDialog`, `GlobalHeader`** | Various | MEDIUM — unnecessary re-renders | Add `React.memo` |
| **Synchronous SQLite on JS thread** | All DB reads | MEDIUM — UI jank during heavy queries | Use Web Workers or chunk reads |
| **Chart library weight** | `gifted-charts` | LOW — bundle size | Consider lighter option or lazy load |

### Startup Performance

| Phase | Current | Optimization |
|-------|---------|-------------|
| Font loading | `useFonts` blocks render | Already uses splash screen ✅ |
| DB init | 3 retries with 2s delay | Reduce delay, pre-create indexes |
| Context providers | 10 nested providers | Lazy-mount non-critical providers |
| Translation data | 7,600 lines inline in settings | Code-split per language |
| Notification checks | All 15+ run on mount | Defer non-critical checks |

### Bundle Size

| Asset | Estimated Size | Recommendation |
|-------|---------------|----------------|
| Inline translations | ~200KB (4 languages) | Move to JSON, lazy load |
| `react-native-vector-icons` | ~2MB iOS / ~4MB Android | Remove (unused — using lucide) |
| Base64 logo in PDF utils | ~7KB | Import as file asset |
| `gifted-charts` | ~50KB | Evaluate lighter alternatives |

---

## BUSINESS LOGIC AUDIT

### Inventory

| Edge Case | Status | Risk |
|-----------|--------|------|
| Negative quantity sale | **No validation** | HIGH — increases inventory instead of reducing |
| Selling more than in stock | **No validation** | HIGH — negative inventory possible |
| Concurrent sales of same item | **No optimistic locking** | HIGH — both succeed, inventory understated |
| Return quantity > sold | **Validated** (in processReturn) | OK for returns, not elsewhere |
| Zero-price items | **No validation** | LOW — may be intentional |

### Sales & Financial

| Edge Case | Status | Risk |
|-----------|--------|------|
| Debt payment > remaining | **Partially validated** | MEDIUM — can overpay |
| Payment to non-existent customer | **No FK validation** | HIGH — orphan records |
| Negative discount | **No validation** | MEDIUM — increases total price |
| 100%+ discount | **No validation** | MEDIUM — zero or negative revenue |
| Delete sale after return processed | **No cascading delete** | HIGH — orphan returns |
| Cart total NaN (non-numeric input) | **Checked at checkout** | MEDIUM — display shows NaN but blocks submission |

### Budget

| Edge Case | Status | Risk |
|-----------|--------|------|
| Budget category with linked expenses | Handled (SET NULL) ✅ | — |
| Budget period in past | **No validation** | LOW — allowed |
| Zero-amount budget categories | **No validation** | LOW — allowed |
| Duplicate budget for same period | **No uniqueness check** | MEDIUM — conflicting budgets |

### Expenses

| Edge Case | Status | Risk |
|-----------|--------|------|
| Recurring with no end date | **No validation** | LOW — runs forever |
| Expense date in future | **No validation** | MEDIUM — inaccurate reporting |
| Negative expense amount | **No validation** | HIGH — inflates profit |

### Ethiopian Calendar

| Edge Case | Status | Risk |
|-----------|--------|------|
| Leap year detection | **BUGGY** (B8, B9) | CRITICAL — dates off by 1 day |
| Pagumen month (13th month) | **Handled** | OK |
| Tigrinya locale falls back to Amharic | **Worked around** | LOW — may show wrong month names |

---

## CODE QUALITY AUDIT

### Massive Files (Need Decomposition)

| File | Lines | Issue |
|------|-------|-------|
| `src/screens/sales/sales.tsx` | 4,158 | Largest file. 5+ screens in one. |
| `src/screens/dashboard/dashboard.tsx` | 1,637 | Dashboard + sale creation + 7 modals |
| `src/screens/inventory/inventroy.tsx` | 1,027 | Inventory + order creation + on-credit |
| `src/screens/settings/settings.tsx` | 1,092 | Settings + all sub-screens |
| `src/context/SettingsContext.tsx` | 9,767 | Settings logic + ALL translations inline |
| `src/database/db.ts` | 6,611 | DB queries + business logic mixed |
| `src/utils/pdf-utils.ts` | 1,097 | 9 PDF generators + 5 CSV functions |
| `src/utils/csv-utils.ts` | 1,132 | CSV import/export + validation |
| `src/services/notificationService.ts` | 1,173 | 15+ notification check functions |
| `src/screens/sales/sales-details.tsx` | 3,178 | Sale detail + return flow + batch editing |
| `src/screens/inventory/inventroy-form.tsx` | 1,518 | 4-step wizard + restock flow |

### Duplicate Code

| Code | Locations |
|------|-----------|
| Sale creation pipeline | `dashboard.tsx` + `sales.tsx` |
| PIN validation logic | `create-pin.tsx` + `reset-pin.tsx` |
| `SALES_GLASS`/`ORD_GLASS` module-level dead constants | `sales.tsx`, `orders.tsx`, `create-order.tsx`, `sales-details.tsx` |
| `iconFor` function for notification types | `DashboardAlertCard.tsx` (8 cases) + `NotificationDetailSheet.tsx` (17 cases) |
| Priority color/bg logic | `DashboardAlertCard.tsx` + `NotificationDetailSheet.tsx` |
| `FEATURE_KEY_MAP` | `upgrade.tsx` + `manage.tsx` |
| `PLANS` pricing object | `subscription-plans.tsx` + `manage.tsx` |
| SQL queries for reports | `reports.tsx` (written twice — once for CSV, once for PDF) |
| Confetti particle system | `BusinessSuccessModal.tsx` + `SaleSuccessModal.tsx` |

### Dead Code

| Code | File | Why Dead |
|------|------|----------|
| `isFocused \|\| true` | `CustomTabBar.tsx` | Always true, tab label fallback unreachable |
| `contentContainerStyle` and `scrollViewProps` | `KeyboardAwareWrapper.tsx` | Declared but never used in JSX |
| `height` prop | `BottomSheet.tsx` | Declared but never used in JSX |
| 14 glass tokens set to `'transparent'` | `createGlassTokens.ts` | Artifacts from abandoned glass design |
| Module-level `SALES_GLASS`/`ORD_GLASS` | Multiple screen files | Immediately overridden by `useMemo` inside component |
| `theme` destructured but unused | Multiple components | `BusinessHealthCard`, `PremiumActionModal`, `DataSuccessModal` |
| `react-native-vector-icons` | `package.json` | Unused dependency |
| `KeyboardAvoidingView enabled={false}` | `sale-form.tsx` | Effectively disabled dead prop |
| `notes` state initialized `''` and never updated | `inventroy-form.tsx` | Dead state variable |
| `allowSellByBase` state always `true` | `inventroy-form.tsx` | Never toggled |

### TypeScript Quality

**Strongly typed:** `AppText`, `AppCard`, `AppNumber`, `AppRow`, `ChartSkeleton`, `ChartStateView`, `CustomDatePicker`, `PDFLanguageModal`, `pdf-translations.ts`

**Weakly typed (`any` used extensively):**
- `CustomTabBar` — `descriptors: Record<string, any>`, `navigation: any`
- `KeyboardAwareScrollView` — `scrollViewProps: any`
- `UniversalSearch` — `colors: any`, `config: any`
- `ExpenseReminderModal` — `expense: any` (worst offender in codebase)
- `DashboardAlerts` — `(n.data as any)?.intent`
- `item-details.tsx`, `sales-details.tsx`, `inventroy-form.tsx` — `editForm: any`
- `SubscriptionContext` — `payments: any[]`, `renewals: any[]`, `auditLog: any[]`

**Interfaces not exported:** `BottomSheetProps`, all 4 Skeleton variant props, `KeyboardAwareScrollViewProps`

**Typo folder names:**
- `src/screens/inventory/inventroy.tsx` (missing 'o')
- `src/screens/inventory/inventroy-form.tsx` (missing 'o')
- `src/screens/adjustement/adjustment.tsx` (extra 'e')

### Export Consistency

Some components use default exports, others use named exports — no consistent pattern:
- **Default:** `BusinessSuccessModal`, `DataSuccessModal`, `PremiumActionModal`, `PremiumFeatureGate`, `PremiumTrialBanner`, `RecentItemCard`, `SaleSuccessModal`, `SidebarOverlay`
- **Named:** `BusinessAssistant`, `BusinessHealthCard`, `ChartSkeleton`, `ChartStateView`, `DashboardAlertCard`, `DashboardAlerts`, `InAppBanner`, `NotificationDetailSheet`, `PDFLanguageModal`

---

## PRODUCTIVITY AUDIT

### Bulk Operations (Missing)

| Operation | Impact |
|-----------|--------|
| Bulk price update (percentage/direct) | HIGH |
| Bulk category reassignment | MEDIUM |
| Multi-select in sales/contacts for batch delete | MEDIUM |
| Batch order status update | MEDIUM |
| Bulk expense deletion | LOW |
| Export selected as CSV | MEDIUM |

### Shortcuts & Quick Actions (Missing)

| Action | Recommendation |
|--------|---------------|
| Keyboard shortcuts (web) | `Ctrl+N` new sale, `Ctrl+F` search, `Esc` close modal |
| Gesture shortcuts | Double-tap FAB for last action, swipe down to refresh |
| Smart defaults | Remember last payment method, auto-fill customer from contacts |
| Quick inline edit | Long-press inventory item to edit price directly |
| Quick-reorder from low stock alert | One-tap "order more" from notification |

### Form Efficiency

| Form | Friction | Improvement |
|------|----------|-------------|
| New sale | Search → select → qty → price → discount → customer → payment → confirm | Add barcode scan, quick-customer, save-as-template |
| New inventory | 15+ fields across 4 steps | Collapse to essentials, add quick-add from supplier |
| New expense | 6+ fields | Add recent-expense quick-duplicate |
| New contact | 8+ fields | Add "from sale" auto-create |

---

## SETTINGS SCREENS AUDIT (Specific Findings)

| Screen | Issues Found |
|--------|-------------|
| **Warehouse** | No try/catch on DB ops, race condition (no await before refresh), edit icon is `Building2` (should be Pencil) |
| **Warehouse Selector** | **No `onRequestClose` on Modal** (Android back button broken), `onComplete` fires even if save fails, only 2 of 5 form fields exposed |
| **Security (PIN)** | PIN inputs not trimmed, `setPin()` may lose leading zeros, no loading state on SecureStore read failure |
| **Profile** | `router.replace('/dashboard')` loses nav history, no error handling on ImagePicker |
| **Notification** | New categories default to `true`, `toggle` ignores switch value, `getPref` may desync with actual storage |
| **CSV Manager** | **`adjustments` export silently exports 0 records**, hardcoded `'UTF8'` may garble other encodings, no loading spinner during import |
| **Calendar / DateTime** | No `ScrollView` — content may overflow on small screens, hardcoded dead colors in StyleSheet, garbled emoji |

---

## OVERALL PRODUCT REVIEW

### As a Product Designer

Shega Mobile has the makings of a compelling product for Ethiopian SMBs. The Ethiopian calendar support, local language translations (Amharic, Oromo, Tigrinya), Telebirr payment integration, and feature depth tailored to local business needs are genuine differentiators.

**However, the product feels unfinished:**
- 11 screens before reaching the dashboard is unacceptable
- Sale form route is broken (empty cart)
- Premium payment screen has a placeholder account number
- No loading states make the app feel unresponsive
- Inconsistent confirmations erode user trust
- Modal stacks without breadcrumbs confuse non-technical users

### As a UX Designer

The information architecture is logical, but execution needs refinement:
- **Dashboard is overwhelming** — 10+ sections competing for attention
- **Modal hierarchy is confusing** — 5 levels deep with no breadcrumbs
- **Empty states are inconsistent** — some have CTAs, others just text
- **Error messages are technical** — no recovery guidance
- **Missing progressive disclosure** — budgets and adjustments shown alongside core features
- **No onboarding to the app itself** — just feature-specific tutorials users may skip

### As a Security Engineer

**The app is not safe for production in its current state:**
- SQL injection in 30+ database operations is a launch blocker
- Subscription pricing can be arbitrarily modified via URL params
- No session management — once authenticated, forever authenticated
- PIN lockout is in-memory only — trivial to bypass
- Payment system is honor-based with no real-time verification
- No data encryption at rest beyond OS-level SecureStore
- Legacy plaintext PINs may persist on device

### As a Software Architect

The architecture has clear strengths and significant debt:

**Strengths:**
- Clean Expo Router structure (thin pages → thick screen components)
- Well-designed component library with tokens
- Modern React patterns (hooks, context, memo)
- Tutorial system is genuinely impressive
- Universal search is architecturally clean
- Consistent theming across all components

**Debt:**
- **4,158-line sales screen** — impossible to test, reason about, or maintain
- **Duplicate business logic** — sale creation in 2 places, PIN validation in 2 places
- **Zero transactions** — every multi-step operation can corrupt data
- **9,767-line Settings context** — god object
- **6,611-line db.ts** — mixes query building, business logic, and schema management
- **4 different error return patterns** — callers must handle each differently
- **No integration tests** — only test data SQL exists, no assertions
- **Dead code throughout** — unused variables, unreachable branches, stale glass tokens

---

## TOP 20 RECOMMENDED ACTIONS (Priority Order)

| # | Action | Area | Effort | Value |
|---|--------|------|--------|-------|
| 1 | **Fix all SQL injection** (convert `execSync` to parameterized queries) | Security | 3 days | **CRITICAL** |
| 2 | **Add database transactions** to all multi-step operations | Data Integrity | 2 days | **CRITICAL** |
| 3 | **Fix subscription price tampering** (validate price server-side or client-side) | Security | 1 day | **CRITICAL** |
| 4 | **Add route authentication guards + session management** | Security | 2 days | **CRITICAL** |
| 5 | **Fix Ethiopian calendar leap year bug** | Business Logic | 1 day | **CRITICAL** |
| 6 | **Fix VAT calculation (apply after discount)** | Business Logic | 1 day | **HIGH** |
| 7 | **Decompose the 4 largest screens** (sales 4k+, dashboard 1.6k+, settings 1k+, inventory 1k+) | Maintainability | 2 weeks | **HIGH** |
| 8 | **Split SettingsContext** into ThemeContext + LocaleContext + ProfileContext | Performance | 3 days | **HIGH** |
| 9 | **Add data validation at database layer** for all financial operations | Data Integrity | 2 days | **HIGH** |
| 10 | **Add loading states everywhere** using existing Skeleton component | UX | 2 days | **HIGH** |
| 11 | **Fix missing accessibility** (roles, labels, focus management) | Accessibility | 1 week | **HIGH** |
| 12 | **Extract sale creation into reusable hook** | Maintainability | 2 days | **HIGH** |
| 13 | **Remove `react-native-vector-icons` dependency** | Bundle Size | 1 hour | **LOW** |
| 14 | **Fix `CustomTabBar` dead code (`isFocused \|\| true`)** | UI | 1 hour | **MEDIUM** |
| 15 | **Fix `SwipeableItem` stale closure (migrate to gesture-handler)** | UX | 2 days | **HIGH** |
| 16 | **Add data export/backup capability** | Features | 3 days | **HIGH** |
| 17 | **Fix inventory-form.tsx pack insert (add await, batch insert)** | Business Logic | 1 day | **HIGH** |
| 18 | **Consolidate onboarding from 11 screens to 3** | UX | 3 days | **HIGH** |
| 19 | **Persist PIN attempt counter to SecureStore** | Security | 1 day | **HIGH** |
| 20 | **Clean up dead code, fix folder typos, add `onRequestClose` to all Modals** | Code Quality | 3 days | **MEDIUM** |

---

## Detailed File-by-File Scorecard

| File/Directory | Lines | Quality | Key Issue |
|---------------|-------|---------|-----------|
| `src/database/db.ts` | 6,611 | 3/10 | SQL injection, no transactions, no validation |
| `src/context/SettingsContext.tsx` | 9,767 | 4/10 | Fat context, inline translations |
| `src/screens/sales/sales.tsx` | 4,158 | 3/10 | Monolithic, duplicate logic, `any` types |
| `src/screens/sales/sales-details.tsx` | 3,178 | 4/10 | Massive file, duplicate glass constants |
| `src/screens/inventory/inventroy-form.tsx` | 1,518 | 4/10 | Unawaited inserts, typo in path |
| `src/screens/dashboard/dashboard.tsx` | 1,637 | 5/10 | Massive, duplicate sale logic |
| `src/screens/orders/order-detail.tsx` | 704 | 5/10 | Hardcoded strings, missing i18n |
| `src/screens/dashboard/debt-management.tsx` | 1,384 | 6/10 | Good structure, nested component |
| `src/screens/sales/sale-form.tsx` | 1,396 | 5/10 | Route broken (empty cart), good internal logic |
| `src/services/notificationService.ts` | 1,173 | 6/10 | Well-structured, comprehensive |
| `src/services/crypto.ts` | 60 | 5/10 | No KDF, legacy plaintext migration |
| `src/services/biometrics.ts` | 53 | 6/10 | No keychain biometric protection |
| `src/services/updateService.ts` | 279 | 7/10 | Well-structured |
| `src/utils/pdf-utils.ts` | 1,097 | 5/10 | VAT bug, CSV in PDF file, hardcoded logo |
| `src/utils/date-utils.ts` | 354 | 6/10 | Leap year bugs, Ti locale fallback |
| `src/utils/csv-utils.ts` | 1,132 | 7/10 | Well-structured, sync-only |
| `src/utils/formatNumber.ts` | 52 | 8/10 | Clean, well-tested |
| `src/components/AppText.tsx` | 190 | 9/10 | Excellent design |
| `src/components/CustomTabBar.tsx` | 223 | 4/10 | Dead code, `any` types |
| `src/components/SwipeableItem.tsx` | 175 | 3/10 | Stale closure, inaccessible |
| `src/components/ErrorBoundary.tsx` | 63 | 3/10 | Hardcoded English, no retry |
| `src/components/Skeleton.tsx` | 218 | 7/10 | Clean but not exported, dark detection fragile |
| `src/screens/settings/security.tsx` | 217 | 5/10 | No trimming, leading zero issue |
| `src/screens/settings/warehouse-selector.tsx` | 273 | 4/10 | Missing `onRequestClose`, no error handling |
| `src/screens/settings/csv-manager.tsx` | 727 | 5/10 | Missing adjustments export, encoding assumption |
| `src/screens/subscription/subscription-payment.tsx` | 450 | 4/10 | Placeholder account, price tampering |
| `app/sale-form.tsx` | 5 | **1/10** | Broken — empty cart, no callbacks |
| `app/welcome-choice.tsx` | 12 | 3/10 | Missing React import |

---

## Conclusion

**Shega Mobile cannot be considered production-ready.** The app has an excellent foundation — strong design system, comprehensive feature set, local language support, Ethiopian calendar — but is undermined by:

1. **Critical security vulnerabilities** (SQL injection, subscription price tampering, no route guards)
2. **Critical data integrity issues** (no transactions, Ethiopian calendar bug, VAT bug)
3. **Critical UX problems** (11-screen onboarding, 4k+ line files, no loading states, broken sale form route)
4. **Critical code quality debt** (massive files, duplicate code, dead code, `any` types)

Addressing the **Top 20 Recommendations** would move the app from **5.5/10 to 8.5/10** — genuinely competitive with international products while serving the unique needs of Ethiopian businesses.

**Launch blockers (must fix first):**
1. SQL injection (30+ occurrences)
2. Database transactions
3. Subscription price tampering
4. Route guards + session management
5. Ethiopian calendar leap year bug

---

*Report generated by comprehensive codebase audit — July 21, 2026*
*Every file, component, service, hook, context, utility, database query, and configuration file reviewed*
