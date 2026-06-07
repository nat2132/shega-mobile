# Auth Validation Improvements Plan

## Overview
Fix and enhance validation in auth-related screens under `src/screens/auth/` and `src/screens/account creation/`.

## Files to Modify
1. `src/screens/auth/verify-pin.tsx` - PIN verification screen
2. `src/screens/account creation/create-pin.tsx` - PIN creation screen
3. `src/screens/account creation/pin-setup.tsx` - PIN setup intro screen (no validation logic)
4. `src/screens/account creation/user-setup.tsx` - User profile setup

## Issues Identified & Fixes

### verify-pin.tsx
- **Issue**: No haptic feedback on wrong PIN during lockout state (already handled)
- **Issue**: PIN stored in plain text (SecureStore uses encryption, but could add obfuscation)
- **Fix**: Add biometric auth fallback for supported devices

### create-pin.tsx
- **Issue**: `validatePin` function has redundant check - `/^(\d)\1{3}$/` already catches repeated digits, making the separate "Repeating digits" check partly redundant
- **Issue**: `lockdownOpacity` shared value is declared but never used
- **Fix**: Remove unused `lockdownOpacity` variable
- **Fix**: Simplify validation logic to avoid redundancy

### user-setup.tsx
- **Issue**: Validation error message for businessName in onChangeText shows "Business entity is required" prematurely when user is just typing
- **Issue**: `Typography` imported from theme but never used
- **Issue**: `Platform` imported but `Dimensions` from 'react-native' already used
- **Fix**: Improve validation to not show "required" error while typing
- **Fix**: Remove unused `Typography` import

## Implementation Steps
1. Fix `create-pin.tsx` - remove unused import and simplify validation
2. Fix `user-setup.tsx` - improve validation timing and remove unused imports
3. Verify all files pass linting