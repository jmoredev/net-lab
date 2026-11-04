import type { DomainMessageCode } from '../domain/types';
import type { UiKey } from './types';

/**
 * English dictionary (D22, S38). It mirrors the Spanish one key by key — TypeScript refuses
 * a dictionary with a key missing — and it is written as English, not as a word-by-word
 * copy of the Spanish sentence: the student reads the same idea, not the same syntax (S42).
 */
export const EN: Record<UiKey | DomainMessageCode, string> = {
  // Shell
  'app.title': 'Net-Lab — network lab',
  'header.loadExample': 'Load example',
  'header.clearLab': 'Clear lab',
  'banner.dismiss': 'Dismiss',
  'confirm.loadExample': 'Load the example? Every device and cable in the lab will be removed.',
  'confirm.clearLab': 'Clear the lab? Every device and cable will be removed.',

  // Language switcher (S36)
  'lang.switcher': 'Language',
  'lang.es': 'ES',
  'lang.en': 'ENG',

  // Palette
  'palette.label': 'Device palette',
  'palette.title': 'Devices',
  'palette.routerTaken': 'The lab already has a router.',
  'palette.hint': 'Click a device to add it, or drag it onto the canvas.',
  'palette.trashHint': 'Drop here to delete',

  // Device kinds
  'kind.router': 'Router',
  'kind.switch': 'Switch',
  'kind.laptop': 'Laptop',
  'kind.desktop': 'Desktop',
  'kind.phone': 'Phone',
  'kind.internet': 'Internet',

  // Canvas
  'canvas.zone': 'Canvas',
  'canvas.description':
    'Network lab canvas: drag a device to move it and click one to open its panel',
  'canvas.emptyTitle': 'The lab is empty.',
  'canvas.emptyHint': 'Drag a device from the palette to get started.',
  'canvas.sending': 'Sending a packet from {from} to {to}',
  'canvas.unknownDevice': 'a device',
  'canvas.cableBetween': 'Cable between {from} and {to}',
  'canvas.portLabel': '{device}, {port}',
  'canvas.deleteCable': 'Delete the selected cable',
  'canvas.wifiOnline': 'WiFi connected',
  'canvas.wifiOff': 'WiFi switched off',
  'canvas.wifiDisconnected': 'WiFi not joined',

  // Shared state words
  'status.online': 'Has Internet access',
  'status.offline': 'No Internet access',

  // Device panel
  'panel.label': 'Selected device panel',
  'panel.internetFixed': 'The Internet node is fixed: it cannot be moved or removed.',
  'panel.connections': 'Connections',
  'panel.addressing': 'Addressing',
  'panel.configuration': 'Settings',
  'panel.ports': 'Ports',
  'panel.cable': 'Cable',
  'panel.phoneNoCable': 'A phone takes no cable: it connects over WiFi only.',
  'panel.connectByCable': 'Connect with a cable',
  'panel.cables': 'Cables',
  'panel.send': 'Send a packet',
  'panel.noTargets': 'There is no other device to send to.',
  'panel.concepts': 'Key ideas',

  // Fields
  'field.name': 'Name',
  'field.mac': 'MAC',
  'field.ip': 'IP',
  'field.gateway': 'Gateway',
  'field.internet': 'Internet',
  'field.ethernet': 'Ethernet',
  'field.wifi': 'WiFi',
  'field.ipAddress': 'IP address',
  'field.manualIp': 'Manual IP',
  'field.routerLanIp': 'Router LAN address',
  'field.wanAddress': 'WAN address',
  'field.noConnection': 'Not connected',
  'field.dhcpStart': 'DHCP range: from',
  'field.dhcpEnd': 'DHCP range: to',
  'field.destination': 'Destination',

  // Ports
  'port.lan': 'LAN {number}',
  'port.numbered': 'Port {number}',
  'port.wan': 'WAN',
  'port.ethernet': 'Ethernet',
  'port.occupied': 'Used by {device}',
  'port.free': 'Free',

  // Addressing mode
  'mode.dhcp': 'Automatic (DHCP)',
  'mode.manual': 'Manual',

  // Actions
  'action.connectWifi': 'Join the WiFi',
  'action.disconnectWifi': 'Leave the WiFi',
  'action.disconnect': 'Disconnect',
  'action.send': 'Send',
  'action.deleteDevice': 'Delete device',

  // No route at all (S23)
  'send.noRoute': 'There is no route to {name}.',
  'send.unknownDestination': 'the destination',

  // Domain diagnostics (S22)
  'ethernet-disabled': 'Ethernet is switched off on this device.',
  'wifi-disabled': 'WiFi is switched off on this device.',
  'not-connected': 'This device is not connected to any network.',
  'router-wifi-off': 'WiFi is switched off on the router.',
  'dead-end-cable': 'This cable goes to {device}, which has no way out to the Internet.',
  'no-lease': 'The router has no free addresses left in its DHCP range.',
  'ip-outside-subnet': 'IP {ip} is not in the subnet {network}.0.',
  'ip-duplicate': 'IP {ip} is already in use by {device}.',
  'gateway-wrong': 'The gateway {gateway} is not the router address ({routerIp}).',
  'router-no-wan': 'The router is not connected to the Internet: the WAN cable is missing.',
  'router-no-wan-address': 'The router has no address on the WAN yet.',

  // Domain validation failures
  'internet-not-addable': 'The Internet node cannot be added.',
  'router-already-exists': 'The lab already has a router.',
  'name-empty': 'The name cannot be empty.',
  'device-missing': 'That device no longer exists.',
  'name-taken': 'A device called {name} already exists.',
  'internet-not-deletable': 'The Internet node cannot be deleted.',
  'self-connection': 'A device cannot be connected to itself.',
  'phone-no-cable': 'A phone takes no cable: it connects over WiFi only.',
  'port-missing': 'That port does not exist.',
  'port-occupied': 'That port is already taken.',
  'wan-not-router': 'That WAN port does not belong to a router.',
  'wan-only-internet': 'The WAN port only connects to the Internet node.',
  'internet-only-wan': 'The Internet node only connects to the WAN port of the router.',
  'cable-missing': 'That cable no longer exists.',
  'no-ethernet': 'This device has no Ethernet port.',
  'no-wifi': 'This device has no WiFi.',
  'no-wifi-network': 'There is no WiFi network available.',
  'no-router-yet': 'There is no router in the lab yet.',
  'invalid-ipv4': 'Type a valid IPv4 address, for example 192.168.1.1.',
  'router-ip-broadcast': 'The router address cannot end in .0 or .255.',
  'dhcp-range-outside-subnet': 'The range must be inside the subnet {network}.',
  'dhcp-range-includes-router': 'The range cannot include the router address ({routerIp}).',
  'dhcp-range-inverted': 'The last address must be greater than or equal to the first address.',
  'invalid-client-ipv4': 'Type a valid IPv4 address, for example 192.168.1.20.',
  'invalid-gateway': 'Type a valid gateway, for example 192.168.1.1.',
  'address-not-assignable': 'This device has no IP address.',
};
