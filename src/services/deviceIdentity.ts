/**
 * This device's human-readable identity.
 *
 * Lives in its own module because both `mobilePairingBeacon` (mDNS beacons) and
 * `mobileSyncServer` (`DEVICE_HELLO` replies for LAN sweeps) need the device
 * name, and those two already depend on each other for the sync port — keeping
 * the name here avoids a circular import.
 */

import { Platform } from 'react-native';

/** Real device name for beacons/discovery lists ("Abebe's iPhone" style). */
export function getThisDeviceName(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device');
    const os = Platform.OS === 'ios' ? 'iPhone' : 'Android';
    const owner = Device?.deviceName || Device?.modelName;
    return owner ? `${os} — ${owner}`.slice(0, 48) : os;
  } catch {
    return Platform.OS === 'ios' ? 'iPhone' : 'Android';
  }
}
