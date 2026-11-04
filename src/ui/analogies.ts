/**
 * Context help for every concept that carries didactic value (S5).
 *
 * `term` is the concept as the specification names it and `analogy` is the text of
 * the "Analogías" table copied verbatim, so the student always meets the technical
 * name first and the everyday image second (D15). `explanation` states the fact in
 * one accessible sentence; for NAT it is the wording proposed in S30.
 */

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

export const ANALOGIES: Record<AnalogyKey, Analogy> = {
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
    analogy: 'Como el número de tu puerta. Sirve para que te encuentren, y si te mudas de red, cambia.',
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
    analogy: 'Como la puerta de la calle: todo lo que va hacia afuera sale por ahí. Si no sabes dónde está, se lo preguntas al router.',
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
    analogy: 'Como el recepcionista de un hotel: no eliges la habitación, te asigna una libre y anota quién la tiene.',
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
    analogy: 'Como una tubería dedicada frente a hablar por el aire: el cable es exclusivo de ese tramo, la WiFi la comparten todos.',
  },
  wan: {
    term: 'Puerto WAN',
    explanation: 'Es el puerto del router que da a Internet, separado de los puertos de la red local.',
    analogy: 'Como la puerta que da a la calle, separada de las puertas hacia las viviendas.',
  },
  lan: {
    term: 'Puertos LAN',
    explanation: 'Son los puertos del router para la red local: cada cable ocupa uno y el router tiene cuatro.',
    analogy: 'Como las puertas interiores del edificio: cada cable ocupa una, y si están todas ocupadas no entra nadie más.',
  },
  nat: {
    term: 'NAT',
    explanation:
      'Los dispositivos de casa usan direcciones privadas y el router sale a Internet con una sola dirección pública. Cuando la respuesta vuelve, el router sabe a qué dispositivo entregarla.',
    analogy: 'Como la ventanilla de la recepción: hacia afuera todos los mensajes llevan la dirección del edificio, no la de cada vivienda.',
  },
};
