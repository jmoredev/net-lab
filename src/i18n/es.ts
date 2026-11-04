import type { DomainMessageCode } from '../domain/types';
import type { UiKey } from './types';

/**
 * Spanish dictionary (D22). This is the language the lab opens in (S37) and the one the
 * whole existing suite asserts, so every sentence here is copied from the screen as it
 * was before the catalogue existed: **not a comma changes** (S38).
 *
 * Values that interpolate something are templates with `{name}` placeholders, filled from
 * the raw `MessageParams` the domain already carries (D21). The Spanish texts of the
 * domain messages double as the internal fallback the domain returns (S40).
 */
export const ES: Record<UiKey | DomainMessageCode, string> = {
  // Shell
  'app.title': 'Net-Lab — laboratorio de redes',
  'header.loadExample': 'Cargar ejemplo',
  'header.clearLab': 'Vaciar laboratorio',
  'banner.dismiss': 'Descartar',
  'confirm.loadExample': '¿Seguro que quieres cargar el ejemplo? Se quitarán todos los dispositivos y sus cables.',
  'confirm.clearLab': '¿Seguro que quieres vaciar el laboratorio? Se quitarán todos los dispositivos y sus cables.',

  // Language switcher (S36)
  'lang.switcher': 'Idioma',
  'lang.es': 'ES',
  'lang.en': 'ENG',

  // Palette
  'palette.label': 'Paleta de dispositivos',
  'palette.title': 'Dispositivos',
  'palette.routerTaken': 'Ya hay un router en el laboratorio.',
  'palette.hint': 'Pulsa un dispositivo para añadirlo o arrástralo al lienzo.',
  'palette.trashHint': 'Suelta aquí para eliminar',

  // Device kinds
  'kind.router': 'Router',
  'kind.switch': 'Switch',
  'kind.laptop': 'Portátil',
  'kind.desktop': 'Sobremesa',
  'kind.phone': 'Móvil',
  'kind.internet': 'Internet',

  // Canvas
  'canvas.zone': 'Lienzo',
  'canvas.description':
    'Lienzo del laboratorio de redes: arrastra los dispositivos para colocarlos y pulsa uno para abrir su panel',
  'canvas.emptyTitle': 'El laboratorio está vacío.',
  'canvas.emptyHint': 'Arrastra un dispositivo desde la paleta para empezar.',
  'canvas.sending': 'Enviando un paquete de {from} a {to}',
  'canvas.unknownDevice': 'un dispositivo',
  'canvas.cableBetween': 'Cable entre {from} y {to}',
  'canvas.portLabel': '{device}, {port}',
  'canvas.deleteCable': 'Eliminar el cable seleccionado',
  'canvas.wifiOnline': 'WiFi conectado',
  'canvas.wifiOff': 'WiFi desactivado',
  'canvas.wifiDisconnected': 'WiFi sin conectar',

  // Shared state words
  'status.online': 'Con salida a Internet',
  'status.offline': 'Sin salida a Internet',

  // Device panel
  'panel.label': 'Panel del dispositivo seleccionado',
  'panel.internetFixed': 'El nodo Internet está fijo: no se puede mover ni eliminar.',
  'panel.connections': 'Conexiones',
  'panel.addressing': 'Direccionamiento',
  'panel.configuration': 'Configuración',
  'panel.ports': 'Puertos',
  'panel.cable': 'Cable',
  'panel.phoneNoCable': 'Un móvil no admite cable: solo se conecta por WiFi.',
  'panel.connectByCable': 'Conectar por cable',
  'panel.cables': 'Cables',
  'panel.send': 'Enviar un paquete',
  'panel.noTargets': 'No hay ningún otro dispositivo al que enviar.',
  'panel.concepts': 'Conceptos',

  // Fields
  'field.name': 'Nombre',
  'field.mac': 'MAC',
  'field.ip': 'IP',
  'field.gateway': 'Puerta de enlace',
  'field.internet': 'Internet',
  'field.ethernet': 'Ethernet',
  'field.wifi': 'WiFi',
  'field.ipAddress': 'Dirección IP',
  'field.manualIp': 'IP manual',
  'field.routerLanIp': 'Dirección LAN del router',
  'field.wanAddress': 'Dirección WAN',
  'field.noConnection': 'Sin conexión',
  'field.dhcpStart': 'Rango DHCP: desde',
  'field.dhcpEnd': 'Rango DHCP: hasta',
  'field.destination': 'Destino',

  // Ports
  'port.lan': 'LAN {number}',
  'port.numbered': 'Puerto {number}',
  'port.wan': 'WAN',
  'port.ethernet': 'Ethernet',
  'port.occupied': 'Ocupado por {device}',
  'port.free': 'Libre',

  // Addressing mode
  'mode.dhcp': 'Automática (DHCP)',
  'mode.manual': 'Manual',

  // Actions
  'action.connectWifi': 'Conectar a la WiFi',
  'action.disconnectWifi': 'Desconectar de la WiFi',
  'action.disconnect': 'Desconectar',
  'action.send': 'Enviar',
  'action.deleteDevice': 'Eliminar dispositivo',

  // No route at all (S23)
  'send.noRoute': 'No hay ningún camino hasta {name}.',
  'send.unknownDestination': 'el destino',

  // Domain diagnostics (S22): the eleven rows of the diagnosis table.
  'ethernet-disabled': 'La conexión Ethernet está desactivada en este dispositivo.',
  'wifi-disabled': 'La conexión WiFi está desactivada en este dispositivo.',
  'not-connected': 'Este dispositivo no está conectado a ninguna red.',
  'router-wifi-off': 'El WiFi del router está desactivado.',
  'dead-end-cable': 'Este cable va a {device}, que no da salida a Internet.',
  'no-lease': 'El router no tiene direcciones libres en su rango DHCP.',
  'ip-outside-subnet': 'La IP {ip} no pertenece a la subred {network}.0.',
  'ip-duplicate': 'La IP {ip} ya está en uso por {device}.',
  'gateway-wrong': 'La puerta de enlace {gateway} no es la del router ({routerIp}).',
  'router-no-wan': 'El router no está conectado a Internet: falta el cable WAN.',
  'router-no-wan-address': 'El router aún no tiene dirección en la WAN.',

  // Domain validation failures.
  'internet-not-addable': 'El nodo Internet no se puede añadir.',
  'router-already-exists': 'Ya hay un router en el laboratorio.',
  'name-empty': 'El nombre no puede estar vacío.',
  'device-missing': 'Ese dispositivo ya no existe.',
  'name-taken': 'Ya hay un dispositivo llamado {name}.',
  'internet-not-deletable': 'El nodo Internet no se puede eliminar.',
  'self-connection': 'Un dispositivo no se puede conectar a sí mismo.',
  'phone-no-cable': 'Un móvil no admite cable: solo se conecta por WiFi.',
  'port-missing': 'Ese puerto no existe.',
  'port-occupied': 'Ese puerto ya está ocupado.',
  'wan-not-router': 'Ese puerto WAN no pertenece a un router.',
  'wan-only-internet': 'El puerto WAN solo se conecta a Internet.',
  'internet-only-wan': 'El nodo Internet solo se conecta al puerto WAN del router.',
  'cable-missing': 'Ese cable ya no existe.',
  'no-ethernet': 'Este dispositivo no tiene puerto Ethernet.',
  'no-wifi': 'Este dispositivo no tiene WiFi.',
  'no-wifi-network': 'No hay ninguna red WiFi disponible.',
  'no-router-yet': 'Todavía no hay ningún router en el laboratorio.',
  'invalid-ipv4': 'Escribe una dirección IPv4 válida, por ejemplo 192.168.1.1.',
  'router-ip-broadcast': 'La dirección del router no puede terminar en .0 ni en .255.',
  'dhcp-range-outside-subnet': 'El rango debe estar dentro de la subred {network}.',
  'dhcp-range-includes-router': 'El rango no puede incluir la dirección del router ({routerIp}).',
  'dhcp-range-inverted': 'La dirección final debe ser mayor o igual que la inicial.',
  'invalid-client-ipv4': 'Escribe una dirección IPv4 válida, por ejemplo 192.168.1.20.',
  'invalid-gateway': 'Escribe una puerta de enlace válida, por ejemplo 192.168.1.1.',
  'address-not-assignable': 'Este dispositivo no tiene dirección IP.',
};
