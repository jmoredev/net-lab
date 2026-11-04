/**
 * Context help for every concept that carries didactic value (S5), in both languages.
 *
 * `term` is the concept as the specification names it and `analogy` is the text of
 * the "Analogías" table copied verbatim, so the student always meets the technical
 * name first and the everyday image second (D15). `explanation` states the fact in
 * one accessible sentence; for NAT it is the wording proposed in S30.
 *
 * The Spanish side is the text as it was written; the English side says the same thing
 * with the same didactic intent and does not copy the Spanish syntax (S42, T5).
 */
import type { Lang } from '../i18n/types';

export type AnalogyKey =
  | 'router'
  | 'switch'
  | 'internet'
  | 'ip'
  | 'mac'
  | 'gateway'
  | 'wifi'
  | 'dhcp'
  | 'manualIp'
  | 'subnet'
  | 'cable'
  | 'wan'
  | 'lan'
  | 'nat';

export interface Analogy {
  term: string;
  explanation: string;
  analogy: string;
}

export const ANALOGIES: Record<Lang, Record<AnalogyKey, Analogy>> = {
  es: {
    router: {
      term: 'Router',
      explanation: 'Es el equipo que reparte las direcciones de la red local y por el que sale todo el tráfico hacia Internet.',
      analogy:
        'Como el portero de un edificio: todo lo que sale de las viviendas pasa por él y él sabe cómo llegar a la calle. Además reparte las direcciones de las viviendas.',
    },
    switch: {
      term: 'Switch',
      explanation: 'Conecta por cable varios equipos de la misma red local y no reparte direcciones IP.',
      analogy:
        'Como el repartidor de un mismo piso: mueve los mensajes entre oficinas del mismo edificio sin salir a la calle. Por eso no necesita dirección propia.',
    },
    internet: {
      term: 'Internet',
      explanation: 'Es la red pública a la que el router se conecta por su puerto WAN.',
      analogy:
        'Como la red de calles de la ciudad: cada edificio tiene una dirección hacia afuera y las calles conectan unos edificios con otros.',
    },
    ip: {
      term: 'Dirección IP',
      explanation: 'Es la dirección que identifica a un dispositivo dentro de la red, y cambia si cambia la red.',
      analogy:
        'Como el número de tu puerta. Sirve para que te encuentren, y si te mudas de red, cambia.',
    },
    mac: {
      term: 'Dirección MAC',
      explanation: 'Es la dirección fija que trae de fábrica la tarjeta de red de cada dispositivo y no depende de dónde esté.',
      analogy:
        'Como el número de serie grabado en el aparato: viene de fábrica, no se puede cambiar y no dice dónde está el aparato.',
    },
    gateway: {
      term: 'Puerta de enlace',
      explanation: 'Es la dirección del router dentro de la red local: todo lo que va hacia fuera pasa por ella.',
      analogy:
        'Como la puerta de la calle: todo lo que va hacia afuera sale por ahí. Si no sabes dónde está, se lo preguntas al router.',
    },
    wifi: {
      term: 'WiFi',
      explanation: 'Es la conexión inalámbrica a la red del router: funciona sin cable y solo dentro de su alcance.',
      analogy:
        'Como la cobertura de una radio: hay que estar dentro del alcance y que alguien la esté emitiendo. Si el router apaga la emisión, nadie la escucha.',
    },
    dhcp: {
      term: 'DHCP',
      explanation: 'Es el servicio del router que asigna automáticamente una dirección IP libre a cada dispositivo que se conecta.',
      analogy:
        'Como el recepcionista de un hotel: no eliges la habitación, te asigna una libre y anota quién la tiene.',
    },
    manualIp: {
      term: 'IP manual',
      explanation: 'Es escribir la dirección IP a mano en el dispositivo en lugar de recibirla del DHCP.',
      analogy:
        'Como elegir tú mismo la habitación: si ya está ocupada hay conflicto, y si el número no existe en ese piso no hay dónde dormir.',
    },
    subnet: {
      term: 'Subred /24',
      explanation: 'Es el grupo de direcciones que comparten los tres primeros números, como 192.168.1.x, y que se hablan sin salir a Internet.',
      analogy:
        'Como las viviendas de un mismo edificio: comparten el principio de la dirección (192.168.1.x) y por eso se hablan sin salir a la calle.',
    },
    cable: {
      term: 'Cable frente a WiFi',
      explanation: 'El cable es la conexión física por el puerto Ethernet; la WiFi es la conexión inalámbrica compartida.',
      analogy:
        'Como una tubería dedicada frente a hablar por el aire: el cable es exclusivo de ese tramo, la WiFi la comparten todos.',
    },
    wan: {
      term: 'Puerto WAN',
      explanation: 'Es el puerto del router que da a Internet, separado de los puertos de la red local.',
      analogy:
        'Como la puerta que da a la calle, separada de las puertas hacia las viviendas.',
    },
    lan: {
      term: 'Puertos LAN',
      explanation: 'Son los puertos del router para la red local: cada cable ocupa uno y el router tiene cuatro.',
      analogy:
        'Como las puertas interiores del edificio: cada cable ocupa una, y si están todas ocupadas no entra nadie más.',
    },
    nat: {
      term: 'NAT',
      explanation:
        'Los dispositivos de casa usan direcciones privadas y el router sale a Internet con una sola dirección pública. Cuando la respuesta vuelve, el router sabe a qué dispositivo entregarla.',
      analogy:
        'Como la ventanilla de la recepción: hacia afuera todos los mensajes llevan la dirección del edificio, no la de cada vivienda.',
    },
  },
  en: {
    router: {
      term: 'Router',
      explanation: 'It is the box that hands out the addresses of the local network, and all traffic to the Internet leaves through it.',
      analogy:
        'Think of the doorman of a block of flats: everything leaving a flat goes past him, and he knows the way out to the street. He also hands each flat its address.',
    },
    switch: {
      term: 'Switch',
      explanation: 'It connects several devices of the same local network by cable, and it does not hand out IP addresses.',
      analogy:
        'Think of a messenger who works inside one building only: they carry messages from office to office and never go out to the street, so they need no street address of their own.',
    },
    internet: {
      term: 'Internet',
      explanation: 'It is the public network the router plugs into through its WAN port.',
      analogy:
        'Think of the street network of a city: every building has one address that faces the street, and the streets join one building to another.',
    },
    ip: {
      term: 'IP address',
      explanation: 'It is the address that identifies a device inside the network, and it changes when the network changes.',
      analogy:
        'Think of your door number: it is how people find you, and it changes when you move to another network.',
    },
    mac: {
      term: 'MAC address',
      explanation: 'It is the fixed address the network card of every device brings from the factory, and it does not depend on where the device is.',
      analogy:
        'Think of the serial number stamped on the device: it comes from the factory, it cannot be changed and it says nothing about where the device is.',
    },
    gateway: {
      term: 'Gateway',
      explanation: 'It is the router address inside the local network: everything going outwards leaves through it.',
      analogy:
        'Think of the front door of the building: nothing reaches the street except through it, and every flat has to know its address.',
    },
    wifi: {
      term: 'WiFi',
      explanation: 'It is the wireless connection to the router network: no cable, and only within range.',
      analogy:
        'Think of a radio broadcast: you have to be within range, and someone has to be transmitting. If the router stops transmitting, nobody hears it.',
    },
    dhcp: {
      term: 'DHCP',
      explanation: 'It is the router service that automatically gives a free IP address to every device that joins.',
      analogy:
        'Think of a hotel receptionist: you do not pick the room, you are given a free one and the desk writes down who has it.',
    },
    manualIp: {
      term: 'Manual IP',
      explanation: 'It means typing the IP address on the device yourself instead of receiving it from DHCP.',
      analogy:
        'Think of choosing your own room: if someone already has it there is a clash, and if the number does not exist on that floor there is nowhere to sleep.',
    },
    subnet: {
      term: 'Subnet /24',
      explanation: 'It is the group of addresses that share the first three numbers, such as 192.168.1.x, and that reach each other without going out to the Internet.',
      analogy:
        'Think of the flats of one building: they share the beginning of the address (192.168.1.x), so they talk to each other without going out to the street.',
    },
    cable: {
      term: 'Cable versus WiFi',
      explanation: 'The cable is the physical connection through the Ethernet port; WiFi is the shared wireless connection.',
      analogy:
        'Think of a pipe of your own against talking through the air: the cable belongs to that stretch alone, while the WiFi is shared by everybody.',
    },
    wan: {
      term: 'WAN port',
      explanation: 'It is the router port that faces the Internet, kept apart from the local network ports.',
      analogy: 'Think of the door that opens onto the street, kept apart from the doors to the flats.',
    },
    lan: {
      term: 'LAN ports',
      explanation: 'They are the router ports for the local network: every cable takes one, and the router has four.',
      analogy:
        'Think of the inner doors of the building: each cable takes one, and when they are all taken no other device can join the network.',
    },
    nat: {
      term: 'NAT',
      explanation:
        'Home devices use private addresses and the router goes out to the Internet with a single public address. When the answer comes back, the router knows which device to hand it to.',
      analogy:
        'Think of the reception desk: on the way out, every message carries the address of the building, not the address of each flat, and the desk sends each answer back to the right flat.',
    },
  },
};
