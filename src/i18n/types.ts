/**
 * The two languages of the app (S36, S37) and the keys of the interface catalogue (D22).
 *
 * Every string a student can read lives in `es.ts` and `en.ts` under one of these keys, so a
 * literal left in a component is a bug and a key missing from a dictionary fails to compile.
 */

import type { CaseMessageCode, DiagnosticMessageCode, DomainMessageCode } from '../domain/types';

export type Lang = 'es' | 'en';

/** Every message the domain can produce, re-exported so one type covers the whole catalogue. */
export type { CaseMessageCode, DomainMessageCode, MessageParams } from '../domain/types';

/**
 * Interface strings, grouped by the zone of the screen that owns them. The names are
 * `namespace.thing`, so a key tells where it is rendered without hunting for it.
 */
export type UiKey =
  // Shell: title, header buttons, banner and the two confirmation questions (D23).
  | 'app.title'
  | 'header.labGroup'
  | 'header.loadExample'
  | 'header.caseGroup'
  | 'case.label'
  | 'case.untitled'
  | 'case.by'
  | 'header.clearLab'
  | 'header.shareCase'
  | 'header.importCase'
  | 'banner.dismiss'
  | 'confirm.loadExample'
  | 'confirm.clearLab'
  // Export dialog (S50–S52).
  | 'export.title'
  | 'export.hint'
  | 'export.fieldTitle'
  | 'export.fieldBrief'
  | 'export.fieldAuthor'
  | 'export.linkLabel'
  | 'export.actionCopy'
  | 'export.actionDownload'
  | 'export.copied'
  | 'export.copyManual'
  | 'export.downloaded'
  // Import dialog (S53–S55).
  | 'import.title'
  | 'import.hint'
  | 'import.fieldLabel'
  | 'import.action'
  | 'import.chooseFile'
  | 'import.confirmReplace'
  | 'import.done'
  | 'import.empty'
  // The one word for closing, shared by both dialogs (S63).
  | 'dialog.close'
  // Language switcher (S36, D24).
  | 'lang.switcher'
  | 'lang.es'
  | 'lang.en'
  // Palette.
  | 'palette.label'
  | 'palette.title'
  | 'palette.routerTaken'
  | 'palette.full'
  | 'palette.hint'
  | 'palette.trashHint'
  // Device names of the palette, resolved instead of `CAPABILITIES[kind].label` (S40).
  | 'kind.router'
  | 'kind.switch'
  | 'kind.laptop'
  | 'kind.desktop'
  | 'kind.phone'
  | 'kind.internet'
  // Canvas.
  | 'canvas.zone'
  | 'canvas.description'
  | 'canvas.emptyTitle'
  | 'canvas.emptyHint'
  | 'canvas.sending'
  | 'canvas.unknownDevice'
  | 'canvas.cableBetween'
  | 'canvas.portLabel'
  | 'canvas.deleteCable'
  | 'canvas.wifiOnline'
  | 'canvas.wifiOff'
  | 'canvas.wifiDisconnected'
  // Shared state words: the panel rows and the hover summary say the same thing (S22, S29).
  | 'status.online'
  | 'status.offline'
  // Selected device panel.
  | 'panel.label'
  | 'panel.internetFixed'
  | 'panel.connections'
  | 'panel.addressing'
  | 'panel.configuration'
  | 'panel.ports'
  | 'panel.cable'
  | 'panel.phoneNoCable'
  | 'panel.connectByCable'
  | 'panel.cables'
  | 'panel.send'
  | 'panel.noTargets'
  | 'panel.concepts'
  // Field labels.
  | 'field.name'
  | 'field.mac'
  | 'field.ip'
  | 'field.gateway'
  | 'field.internet'
  | 'field.ethernet'
  | 'field.wifi'
  | 'field.ipAddress'
  | 'field.manualIp'
  | 'field.routerLanIp'
  | 'field.wanAddress'
  | 'field.noConnection'
  | 'field.dhcpStart'
  | 'field.dhcpEnd'
  | 'field.destination'
  // Port state and port names.
  | 'port.lan'
  | 'port.numbered'
  | 'port.wan'
  | 'port.ethernet'
  | 'port.occupied'
  | 'port.free'
  // Addressing mode of a client.
  | 'mode.dhcp'
  | 'mode.manual'
  // Buttons that act on the lab.
  | 'action.connectWifi'
  | 'action.disconnectWifi'
  | 'action.disconnect'
  | 'action.send'
  | 'action.deleteDevice'
  // Undo and redo of the lab, in the header and on the keyboard (S85).
  | 'action.undo'
  | 'action.redo'
  // The failed send, when the route does not exist at all (S23).
  | 'send.noRoute'
  | 'send.unknownDestination'
  // Levels: the «Desafíos» entry, its selector, the goal panel and the banner (S71).
  | 'levels.action'
  | 'levels.selectorTitle'
  | 'levels.selectorHint'
  | 'levels.resume'
  | 'levels.completedBadge'
  // The three difficulties a level can declare: the badge always writes the word (S75).
  | 'levels.difficultyEasy'
  | 'levels.difficultyMedium'
  | 'levels.difficultyHard'
  | 'levels.goalOnline'
  | 'levels.goalManualOnline'
  | 'levels.goalAddressIs'
  | 'levels.goalRouterNetwork'
  | 'levels.goalDeviceNamed'
  | 'levels.goalMet'
  | 'levels.goalPending'
  | 'levels.panelTitle'
  | 'levels.done'
  | 'levels.next'
  | 'levels.backToLevels'
  | 'levels.finishedAll'
  // The ten levels, one title for the selector card and one brief for the panel each.
  | 'levels.enchufa-portatil.title'
  | 'levels.enchufa-portatil.brief'
  | 'levels.falta-cable-internet.title'
  | 'levels.falta-cable-internet.brief'
  | 'levels.wifi-sin-enganchar.title'
  | 'levels.wifi-sin-enganchar.brief'
  | 'levels.switch-del-aula.title'
  | 'levels.switch-del-aula.brief'
  | 'levels.ip-puesta-a-mano.title'
  | 'levels.ip-puesta-a-mano.brief'
  | 'levels.lio-de-cables.title'
  | 'levels.lio-de-cables.brief'
  | 'levels.monta-el-aula.title'
  | 'levels.monta-el-aula.brief'
  | 'levels.reparto-de-direcciones.title'
  | 'levels.reparto-de-direcciones.brief'
  // The two levels of S74, added after the eight of S72 and leaving them untouched.
  | 'levels.la-red-del-otro-aula.title'
  | 'levels.la-red-del-otro-aula.brief'
  | 'levels.el-aula-rotulada.title'
  | 'levels.el-aula-rotulada.brief'
  // The socratic diagnosis (S76–S80): the question of the panel, the hint button, the feedback
  // of the risk, the reveal line and the blocked send, then one short label and one hint for
  // each of the eleven rows of the diagnostic table, named after the code they belong to.
  | 'quiz.question'
  | 'quiz.hintAction'
  | 'quiz.hit'
  | 'quiz.miss'
  | 'quiz.reveal'
  | 'quiz.blockedSend'
  | `quiz.option.${DiagnosticMessageCode}`
  | `quiz.hint.${DiagnosticMessageCode}`;

/** Any key of the catalogue: an interface string, a domain message or a case failure (S57). */
export type MessageKey = UiKey | DomainMessageCode | CaseMessageCode;
