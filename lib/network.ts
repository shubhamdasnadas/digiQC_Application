import os from 'os';
import { NextRequest } from 'next/server';

/**
 * Dynamically resolves the machine's local IPv4 network address (LAN / Wi-Fi IP).
 * Useful when running locally so mobile devices / other LAN computers can connect
 * instead of resolving 'localhost' to themselves.
 */
export function getLocalIpAddress(): string {
  // Check if explicitly configured via environment variable
  if (process.env.MACHINE_IP) return process.env.MACHINE_IP.trim();
  if (process.env.APP_HOST) return process.env.APP_HOST.trim();

  try {
    const interfaces = os.networkInterfaces();
    const candidates: { address: string; priority: number }[] = [];

    for (const [name, netList] of Object.entries(interfaces)) {
      if (!netList) continue;
      const lowerName = name.toLowerCase();

      for (const net of netList) {
        const isIPv4 = net.family === 'IPv4' || (net.family as any) === 4;
        if (!isIPv4 || net.internal) continue;

        // Check for virtual network adapters
        const isVirtual = lowerName.includes('virtual') ||
                          lowerName.includes('vmware') ||
                          lowerName.includes('vbox') ||
                          lowerName.includes('wsl') ||
                          lowerName.includes('vethernet') ||
                          lowerName.includes('hyper-v') ||
                          lowerName.includes('loopback');

        let priority = 10;

        // Wi-Fi or wireless connection - highest priority for local network testing
        if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan') || lowerName.includes('wireless')) {
          priority = 1;
        } else if (lowerName.includes('ethernet') || lowerName.includes('eth') || lowerName.includes('en')) {
          priority = isVirtual ? 5 : 2;
        } else if (isVirtual) {
          priority = 20;
        }

        // Prefer standard private IP ranges
        if (net.address.startsWith('192.168.')) {
          priority -= 0.5;
        } else if (net.address.startsWith('10.')) {
          priority -= 0.3;
        } else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)) {
          priority -= 0.2;
        }

        candidates.push({ address: net.address, priority });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.priority - b.priority);
      return candidates[0].address;
    }
  } catch (err) {
    console.error('Error determining local IP address:', err);
  }

  return 'localhost';
}

/**
 * Returns the dynamic base URL for links (such as email password setup links),
 * dynamically replacing 'localhost' / '127.0.0.1' with the server machine's actual IP
 * so links work across phones and local network devices.
 */
export function getBaseUrl(request?: NextRequest | null): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }

  let host = 'localhost:3000';
  let proto = 'http';

  if (request) {
    host = request.headers.get('x-forwarded-host') || request.headers.get('host') || host;
    proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  }

  // If host is localhost or 127.0.0.1, replace with machine's LAN IP
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (isLocalhost) {
    const machineIp = getLocalIpAddress();
    if (machineIp && machineIp !== 'localhost' && machineIp !== '127.0.0.1') {
      const portMatch = host.match(/:(\d+)$/);
      const port = portMatch ? `:${portMatch[1]}` : ':3000';
      host = `${machineIp}${port}`;
    }
  }

  return `${proto}://${host}`;
}
