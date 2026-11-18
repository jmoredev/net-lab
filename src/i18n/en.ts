import type { CaseMessageCode, DomainMessageCode } from '../domain/types';
import type { UiKey } from './types';

/**
 * English dictionary (D22, S38). It mirrors the Spanish one key by key — TypeScript refuses
 * a dictionary with a key missing — and it is written as English, not as a word-by-word
 * copy of the Spanish sentence: the student reads the same idea, not the same syntax (S42).
 */
export const EN: Record<UiKey | DomainMessageCode | CaseMessageCode, string> = {
  // Shell
  'app.title': 'Net-Lab — network lab',
  'header.labGroup': 'Lab',
  'header.loadExample': 'Load example',
  'header.caseGroup': 'Case',
  'case.label': 'Case brief',
  'case.untitled': 'Untitled case',
  'case.by': 'By {author}',
  'header.clearLab': 'Clear lab',
  'header.shareCase': 'Share case',
  'header.importCase': 'Open case',
  'banner.dismiss': 'Dismiss',
  'confirm.loadExample': 'Load the example? Every device and cable in the lab will be removed.',
  'confirm.clearLab': 'Clear the lab? Every device and cable will be removed.',

  // Export dialog (S50–S52)
  'export.title': 'Share the case',
  'export.hint':
    'Copy the link or download the file. The three fields are optional: leave them empty to share only the lab.',
  'export.fieldTitle': 'Title',
  'export.fieldBrief': 'Brief',
  'export.fieldAuthor': 'Author',
  'export.linkLabel': 'Case link',
  'export.actionCopy': 'Copy link',
  'export.actionDownload': 'Download .json',
  'export.copied': 'Link copied.',
  'export.copyManual': 'It could not be copied on its own. The link is selected: press Ctrl+C.',
  'export.downloaded': 'Download started: {file}',

  // Import dialog (S53–S55)
  'import.title': 'Open a case',
  'import.hint':
    'Paste the link, the code or the contents of the .json file. You can also drop it here.',
  'import.fieldLabel': 'Link, code or file',
  'import.action': 'Open',
  'import.chooseFile': 'Choose a file',
  'import.confirmReplace': 'This replaces the lab you have open. Continue?',
  'import.done': 'Case opened: {title}',
  'import.empty': 'Paste something first.',

  // Shared by both dialogs (S63)
  'dialog.close': 'Close',

  // Language switcher (S36)
  'lang.switcher': 'Language',
  'lang.es': 'ES',
  'lang.en': 'ENG',

  // Palette
  'palette.label': 'Device palette',
  'palette.title': 'Devices',
  'palette.routerTaken': 'The lab already has a router.',
  'palette.full': 'The lab already holds {max} devices.',
  'palette.hint': 'Click a device to add it, or drag it onto the canvas.',
  'palette.trashHint': 'Drop here to delete',

  // Device kinds
  'kind.router': 'Router',
  'kind.switch': 'Switch',
  'kind.laptop': 'Laptop',
  'kind.desktop': 'PC',
  'kind.phone': 'Smartphone',
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
  // Undo and redo of the header, the same action as their shortcuts (S83, S85).
  'action.undo': 'Undo',
  'action.redo': 'Redo',

  // No route at all (S23)
  'send.noRoute': 'There is no route to {name}.',
  'send.unknownDestination': 'the destination',

  // Levels (S71): the «Desafíos» entry, its selector, the goal panel and its banner, then the
  // ten levels of S72 and S74 with one title and one brief each. The goal lines are templates:
  // the panel fills `{name}` with the device the level asks about.
  'levels.action': 'Challenges',
  'levels.selectorTitle': 'Challenges',
  'levels.selectorHint': 'Pick a level: you can jump to any of them and come back another day.',
  'levels.resume': 'Continue here',
  'levels.completedBadge': 'Completed',
  // S75: the difficulty of each level, always as a word; colour only reinforces it.
  'levels.difficultyEasy': 'Easy',
  'levels.difficultyMedium': 'Medium',
  'levels.difficultyHard': 'Hard',
  'levels.goalOnline': '{name} reaches the Internet',
  'levels.goalManualOnline': '{name} browses with its manual IP',
  // S73: the three goals of concrete configuration, with the parameters the panel fills in.
  'levels.goalAddressIs': '{name} browses with exactly the IP {ip} and the gateway {gateway}',
  'levels.goalRouterNetwork': 'The router network is {ip} and its DHCP range runs from {start} to {end}',
  'levels.goalDeviceNamed': '{name} is renamed to {target}',
  // The state of a goal, said out loud: colour alone never reaches a screen reader (S69).
  'levels.goalMet': 'Done',
  'levels.goalPending': 'Pending',
  'levels.panelTitle': 'Level goals',
  'levels.done': 'Level complete!',
  'levels.next': 'Next level',
  'levels.backToLevels': 'Back to the levels',
  'levels.finishedAll': 'You have completed every level.',

  'levels.enchufa-portatil.title': 'Plug in the laptop',
  'levels.enchufa-portatil.brief':
    'The laptop has no cable at all. Connect it to the router so it can reach the Internet.',
  'levels.falta-cable-internet.title': 'The Internet cable is missing',
  'levels.falta-cable-internet.brief':
    'The local network is wired up just fine, but the router cannot reach the Internet. Check its connections.',
  'levels.wifi-sin-enganchar.title': 'WiFi not joined',
  'levels.wifi-sin-enganchar.brief':
    'The laptop has its WiFi switched on, but it has not joined the router network.',
  'levels.switch-del-aula.title': 'The classroom switch',
  'levels.switch-del-aula.brief':
    'Cable the three PCs to the switch and the switch to the router, so the whole class can browse.',
  'levels.ip-puesta-a-mano.title': 'The hand-set IP',
  'levels.ip-puesta-a-mano.brief':
    'The laptop has a manual IP from another network. Fix it so it can browse, without switching to DHCP.',
  'levels.lio-de-cables.title': 'A tangle of cables',
  'levels.lio-de-cables.brief':
    'Three devices and three different problems: no cable, no radio and the wrong IP.',
  'levels.monta-el-aula.title': 'Set up classroom 2.º B',
  'levels.monta-el-aula.brief':
    'Build the whole network: the switch, both PCs by cable, the laptop over WiFi and the line to the Internet.',
  'levels.reparto-de-direcciones.title': 'Sharing out the addresses',
  'levels.reparto-de-direcciones.brief':
    'Two laptops with manual IPs on the wrong networks and a phone that has not joined. Fix all three.',

  'levels.la-red-del-otro-aula.title': 'The other classroom network',
  'levels.la-red-del-otro-aula.brief':
    'The classroom next door uses another network: move the router to 192.168.5.1, set its DHCP range from 100 to 200 and give the laptop exactly 192.168.5.10.',
  'levels.el-aula-rotulada.title': 'The labelled classroom',
  'levels.el-aula-rotulada.brief':
    'Before sharing the network, give everything a name of its own: the router must be called Router-2B and the teacher PC, PC-Docente.',

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

  // The socratic diagnosis (S76–S80). The question and the blocked send carry no reason; the
  // short labels carry no parameter either, so the address, the port and the name of a device
  // only appear in the sentence of the reveal (S77, S80).
  'quiz.question': 'Why do you think it cannot reach the Internet?',
  'quiz.hintAction': 'Give me a hint',
  'quiz.hit': 'You got it!',
  'quiz.miss': 'Not that one',
  'quiz.reveal': 'This is the real problem:',
  'quiz.blockedSend':
    'The packet did not leave: {name} cannot reach the Internet. Take a guess at its diagnosis to see why.',

  // The eleven short labels of S77, one per code of the table above.
  'quiz.option.ethernet-disabled': 'The cable connection is switched off',
  'quiz.option.wifi-disabled': 'The WiFi is switched off',
  'quiz.option.not-connected': 'It is not connected to any network',
  'quiz.option.router-wifi-off': "The router's WiFi is switched off",
  'quiz.option.dead-end-cable': 'Its cable does not reach the router',
  'quiz.option.no-lease': 'It gets no address from the router',
  'quiz.option.ip-outside-subnet': 'Its IP is from another network',
  'quiz.option.ip-duplicate': 'Its IP is repeated',
  'quiz.option.gateway-wrong': 'Its gateway is wrong',
  'quiz.option.router-no-wan': 'The router has no line to the Internet',
  'quiz.option.router-no-wan-address': 'The router did not ask for its public address',

  // The eleven hints of S78: they point at where to look without naming the reason.
  'quiz.hint.ethernet-disabled': 'See whether this machine has its cable connection switched on.',
  'quiz.hint.wifi-disabled': 'The radio can be switched off too: see which connections are on.',
  'quiz.hint.not-connected': 'No path reaches the router: check the cables and the WiFi.',
  'quiz.hint.router-wifi-off': 'The problem may not be in this device: look at the router.',
  'quiz.hint.dead-end-cable': 'Follow the cable with your finger: where does it end?',
  'quiz.hint.no-lease': 'The router hands out addresses: is this device getting one?',
  'quiz.hint.ip-outside-subnet': 'Compare the first three numbers of the IP with the router ones.',
  'quiz.hint.ip-duplicate': 'Two devices cannot carry the same address.',
  'quiz.hint.gateway-wrong': 'The gateway has to be the one of the router.',
  'quiz.hint.router-no-wan': 'The router needs its own line to the Internet too.',
  'quiz.hint.router-no-wan-address':
    'The WAN cable is plugged in: what else does the router need to get out?',

  // Domain validation failures
  'internet-not-addable': 'The Internet node cannot be added.',
  'router-already-exists': 'The lab already has a router.',
  'router-ip-in-dhcp-range': 'The router address cannot be inside the DHCP range ({start}-{end}).',
  'name-empty': 'The name cannot be empty.',
  'device-missing': 'That device no longer exists.',
  'name-taken': 'A device called {name} already exists.',
  'name-too-long': 'The name cannot be longer than {max} characters.',
  'too-many-devices': 'A lab cannot hold more than {max} devices.',
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

  // Case import and export (S57)
  'formato-invalido': 'The link does not contain a valid case. Check that you copied it in full.',
  'version-no-soportada': 'This case was created with another version of Net-Lab ({v}). This version cannot open it.',
  'esquema-invalido': 'The case is missing a value or has one Net-Lab does not accept: {campo}.',
  'demasiados-dispositivos': 'The case has {n} devices and the maximum is {max}.',
  'cable-invalido': 'There is a cable that cannot be connected: {detalle}',
  'payload-demasiado-grande': 'The link is too long to open ({n} characters, maximum {max}).',
};
