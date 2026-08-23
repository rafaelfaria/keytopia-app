import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Private rooms for The Lightstream.
 *
 * A room is a Supabase Realtime channel and nothing else: no table, no row, no
 * cleanup job. Presence is the lobby (who is here, who is ready) and broadcast
 * is the race (start, progress, finish). A room therefore exists exactly as
 * long as somebody is standing in it, which is the correct lifetime for a
 * thing whose whole purpose is "type this with my friend right now".
 *
 * Two deliberate constraints, both about children:
 *
 *   No discovery. You reach a room by holding its code. Nothing enumerates
 *   rooms, so a stranger cannot wander into one.
 *   No free text. The only strings that cross the wire are the display name and
 *   avatar already on the profile, plus the race text, which the host picks
 *   from the bundled sentence list. There is no chat channel to moderate.
 *
 * With no Supabase project configured the module reports `roomsLive() === false`
 * and the caller falls back to a practice room against simulated friends, the
 * same degrade-rather-than-fail rule the leaderboards follow.
 */

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  /** Epoch ms. Earliest player in the room is the host. */
  joinedAt: number;
  you?: boolean;
  /** Crossed the line in the race now running. Carried in presence, see below. */
  done?: boolean;
  /** Walked out of the race now running without finishing it. Also presence. */
  out?: boolean;
}

export type RoomPhase = 'connecting' | 'open' | 'empty' | 'racing' | 'error';

/**
 * The countdown, not a shared clock, is what lines the racers up: three seconds
 * of 3-2-1 absorbs the message latency, and it needs no agreement between
 * machines whose wall clocks can differ by whole seconds.
 */
export interface RoomStartPayload {
  text: string;
}

export interface RoomListeners {
  onPlayers?: (players: RoomPlayer[]) => void;
  onPhase?: (phase: RoomPhase, error?: string) => void;
  onStart?: (p: RoomStartPayload) => void;
  onProgress?: (id: string, progress: number, wpm: number) => void;
  /**
   * `crossed` separates reaching the end of the text from being stopped
   * because the race was already decided. Both take a racer out of it; only
   * one of them is a finish, and a screen that treats them alike credits
   * somebody who never typed a word with second place.
   */
  onFinish?: (id: string, wpm: number, acc: number, crossed: boolean) => void;
  /**
   * Everybody back to the lobby. A rematch is a new gathering rather than an
   * immediate re-run: people ready up again, and anybody holding the link can
   * still walk in before it starts.
   */
  onLobby?: () => void;
}

/** Rooms only carry real people when there is a project to carry them. */
export function roomsLive(): boolean {
  return Boolean(supabase);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1
export function makeRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `TYP-${body}`;
}

export function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = cleaned.startsWith('TYP') ? cleaned.slice(3) : cleaned;
  return body ? `TYP-${body.slice(0, 6)}` : '';
}

/**
 * The link a friend can be sent. Deliberately the PUBLIC address rather than
 * the one inside /app: a room owns no data, so somebody without KeyTopia can
 * stand in one, and a link that bounced them to a sign-in page would be an
 * invitation to make an account rather than an invitation to a race. Anyone who
 * does have a profile is forwarded from there into their own Lightstream.
 *
 * It lives here rather than beside the page that renders it because a component
 * module that also exports a plain function cannot be hot-patched: React Fast
 * Refresh gives up, Vite re-executes the whole import chain up to main.tsx, and
 * for a moment the app is mounted twice with the old copy's timers still
 * running. One helper in the wrong file was enough to cause that.
 */
export function roomUrl(code: string): string {
  return `${window.location.origin}/race/room/${code}`;
}

/** How long a joiner waits for somebody else's presence before calling the code dead. */
const EMPTY_ROOM_GRACE_MS = 2200;

export class Room {
  readonly code: string;
  readonly me: RoomPlayer;
  players: RoomPlayer[] = [];
  phase: RoomPhase = 'connecting';
  error: string | null = null;

  private channel: RealtimeChannel | null = null;
  private listeners: RoomListeners = {};
  private graceTimer = 0;
  private lastProgressSent = 0;
  /**
   * Everyone who has crossed the line in the race now running.
   *
   * Filled from BOTH the finish broadcast and presence, and that redundancy is
   * the point. A broadcast is one fire-and-forget packet: the racer who sends
   * it stops sending anything at all a moment later, so if that single packet
   * is dropped, every other screen leaves their car parked wherever the last
   * progress message put it and shows them still racing, for ever. Presence is
   * state rather than an event, so it re-syncs and heals itself.
   */
  private finished = new Set<string>();
  /**
   * Everyone who left the race now running without finishing it: closed the
   * tab, pressed back, walked to the lobby.
   *
   * Presence alone cannot see this. Going back to the room is not leaving the
   * room, so the host who abandons a race is still standing in presence with a
   * car that has simply stopped, and everybody else raced on against it. Same
   * belt and braces as `finished`: a broadcast for now, a presence flag so a
   * lost one heals.
   */
  private quit = new Set<string>();

  private constructor(code: string, me: RoomPlayer) {
    this.code = code;
    this.me = me;
  }

  /**
   * `expectOthers` separates the two doors into a room. A host is alone on
   * purpose; a joiner alone means the code was wrong, and saying so beats
   * leaving a child staring at an empty lobby that will never fill.
   */
  static open(
    code: string,
    me: { id: string; name: string; avatar: string },
    opts: { expectOthers: boolean },
  ): Room {
    const room = new Room(code, { ...me, ready: !opts.expectOthers ? true : false, joinedAt: Date.now(), you: true });
    room.connect(opts.expectOthers);
    current = room;
    return room;
  }

  private connect(expectOthers: boolean) {
    if (!supabase) { this.setPhase('error', 'Rooms need an internet connection.'); return; }

    // supabase-js keys channels by topic and hands back the EXISTING instance
    // if one is still registered, and adding a presence listener to a channel
    // that has already joined throws outright. `unsubscribe()` alone does not
    // deregister it, so leaving a room and rejoining the same code — a rematch,
    // a mistyped code corrected, a hot reload — reached this line, got the old
    // channel back and took the lobby down on the `on('presence')` below.
    // Clearing any stale instance first makes connecting idempotent.
    const topic = `ktroom:${this.code}`;
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (stale) void supabase.removeChannel(stale);

    const ch = supabase.channel(topic, {
      config: { presence: { key: this.me.id }, broadcast: { self: true } },
    });
    this.channel = ch;

    ch.on('presence', { event: 'sync' }, () => this.syncPresence());
    ch.on('broadcast', { event: 'start' }, ({ payload }) => {
      // A new race clears the old one's finishers, on every screen, before
      // anybody types. Otherwise a rematch opens with cars already parked on
      // the line from the race before it.
      this.finished.clear();
      this.quit.clear();
      this.me.done = false;
      this.me.out = false;
      this.trackMe();
      this.setPhase('racing');
      this.listeners.onStart?.(payload as RoomStartPayload);
    });
    ch.on('broadcast', { event: 'progress' }, ({ payload }) => {
      const p = payload as { id: string; p: number; wpm: number };
      // A single malformed message used to poison a lane permanently:
      // Math.max(progress, undefined) is NaN, NaN survives every later
      // Math.max, and a car positioned at `left: NaN%` is a car that vanishes.
      if (p.id === this.me.id) return;
      const prog = Number.isFinite(p.p) ? Math.min(1, Math.max(0, p.p)) : 0;
      const wpm = Number.isFinite(p.wpm) ? p.wpm : 0;
      this.listeners.onProgress?.(p.id, prog, wpm);
    });
    ch.on('broadcast', { event: 'lobby' }, () => {
      this.finished.clear();
      this.quit.clear();
      this.me.done = false;
      this.me.out = false;
      // Ready flags are left alone. They were already cleared when this browser
      // finished its race (reopen), so what survives to here is somebody having
      // pressed "ready for the next game" on their results screen, and pulling
      // them back to the lobby is no reason to forget they said so.
      this.trackMe();
      this.setPhase('open');
      this.listeners.onLobby?.();
    });
    ch.on('broadcast', { event: 'finish' }, ({ payload }) => {
      const p = payload as { id: string; wpm: number; acc: number; crossed?: boolean };
      if (p.id === this.me.id) return;
      // Only a real finish joins the finished set: that set is what places a
      // car on the line and hands out a rank. Somebody stopped short is out of
      // the race but has not finished it, so they are a quitter for ranking
      // purposes and their lane keeps the distance they reached.
      if (p.crossed === false) this.quit.add(p.id); else this.finished.add(p.id);
      this.listeners.onFinish?.(p.id, p.wpm, p.acc, p.crossed !== false);
    });
    ch.on('broadcast', { event: 'quit' }, ({ payload }) => {
      const p = payload as { id: string };
      if (p.id !== this.me.id) this.quit.add(p.id);
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.trackMe();
        this.setPhase('open');
        if (expectOthers) {
          this.graceTimer = window.setTimeout(() => {
            if (this.players.length <= 1 && this.phase === 'open') {
              this.setPhase('empty', `Nobody is in room ${this.code} right now. Check the code, or ask your friend to create the room first.`);
            }
          }, EMPTY_ROOM_GRACE_MS);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setPhase('error', 'Lost the connection to the room.');
      }
    });
  }

  /** Everything this browser publishes about itself, in one place. */
  private trackMe() {
    void this.channel?.track({
      name: this.me.name, avatar: this.me.avatar,
      ready: this.me.ready, joinedAt: this.me.joinedAt,
      done: this.me.done ?? false,
      out: this.me.out ?? false,
    });
  }

  private syncPresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState<{ name: string; avatar: string; ready: boolean; joinedAt: number; done?: boolean; out?: boolean }>();
    const players: RoomPlayer[] = Object.entries(state).flatMap(([id, entries]) => {
      const e = entries[0];
      if (!e) return [];
      // The self-healing half of both race signals. A dropped broadcast is
      // recovered here on the next sync, without anyone re-sending anything.
      if (id !== this.me.id) {
        if (e.done) this.finished.add(id);
        if (e.out) this.quit.add(id);
      }
      return [{
        id, name: e.name, avatar: e.avatar,
        ready: Boolean(e.ready), joinedAt: e.joinedAt,
        done: Boolean(e.done), out: Boolean(e.out),
        you: id === this.me.id,
      }];
    });
    // Stable order, and the same order on every screen: joined-at, then id.
    players.sort((a, b) => (a.joinedAt - b.joinedAt) || a.id.localeCompare(b.id));
    this.players = players;
    if (players.length > 1 && this.phase === 'empty') this.setPhase('open');
    this.listeners.onPlayers?.(players);
  }

  private setPhase(phase: RoomPhase, error?: string) {
    this.phase = phase;
    this.error = error ?? null;
    this.listeners.onPhase?.(phase, error);
  }

  on(listeners: RoomListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
    // A late subscriber still needs the state that arrived before it existed.
    if (this.players.length) listeners.onPlayers?.(this.players);
  }

  /** Host is whoever has been here longest, so it survives the creator leaving. */
  get isHost(): boolean {
    return this.players.length === 0 || this.players[0]?.id === this.me.id;
  }

  get allReady(): boolean {
    return this.players.length >= 2 && this.players.every((p) => p.ready);
  }

  setReady(ready: boolean): void {
    this.me.ready = ready;
    this.trackMe();
  }

  /** Who has already crossed the line in the race now running. */
  isFinished(id: string): boolean {
    return this.finished.has(id);
  }

  /**
   * Still standing in the room. A racer whose browser closed the tab, went back
   * to the lobby, or lost the connection drops out of presence, and a race
   * against somebody who is not there any more is not a race.
   */
  isPresent(id: string): boolean {
    if (this.quit.has(id)) return false;
    // A presence list that does not contain this browser is not a list to draw
    // conclusions from: mid-resync it can be empty for a beat, and calling
    // everybody absent on that would end the race under them.
    if (!this.players.some((p) => p.you)) return true;
    return this.players.some((p) => p.id === id);
  }

  /**
   * Leaving the race without finishing it. Sent when a racing screen goes away
   * for any reason other than the finish line: back, the room button, the tab
   * closing. Everybody else needs it, because a race whose only rival has
   * walked off is over.
   */
  sendQuit(): void {
    this.me.out = true;
    this.trackMe();
    void this.channel?.send({ type: 'broadcast', event: 'quit', payload: { id: this.me.id } });
  }

  /**
   * Call everybody back to the lobby. Sent by whoever holds the room from the
   * results screen, and received by every screen including the sender's.
   */
  returnToLobby(): void {
    void this.channel?.send({ type: 'broadcast', event: 'lobby', payload: {} });
  }

  start(text: string): void {
    void this.channel?.send({ type: 'broadcast', event: 'start', payload: { text } });
  }

  /** Throttled: lanes are drawn at 25fps, so 10 messages a second is plenty. */
  sendProgress(progress: number, wpm: number): void {
    const now = Date.now();
    if (now - this.lastProgressSent < 100) return;
    this.lastProgressSent = now;
    void this.channel?.send({ type: 'broadcast', event: 'progress', payload: { id: this.me.id, p: progress, wpm } });
  }

  /**
   * Both channels, deliberately. The broadcast is instant and unreliable, the
   * presence flag is a beat slower and cannot be missed, and a rival's car
   * reaching the line is not something a lost packet may quietly cancel.
   */
  sendFinish(wpm: number, acc: number, crossed = true): void {
    if (crossed) this.me.done = true; else this.me.out = true;
    this.trackMe();
    void this.channel?.send({ type: 'broadcast', event: 'finish', payload: { id: this.me.id, wpm, acc, crossed } });
  }

  /** Back to the lobby after a race, so a rematch keeps the same friends. */
  reopen(): void {
    if (this.phase === 'racing') this.setPhase('open');
    this.setReady(this.isHost);
  }

  leave(): void {
    window.clearTimeout(this.graceTimer);
    this.listeners = {};
    // removeChannel, not unsubscribe: the latter leaves the channel registered
    // under its topic, where the next room with the same code would find it.
    const ch = this.channel;
    if (ch) void supabase?.removeChannel(ch);
    this.channel = null;
    if (current === this) current = null;
  }
}

/**
 * The room outlives the hub screen: navigating into the race must not drop the
 * connection, and coming back should land in the lobby you were already in.
 */
let current: Room | null = null;
export function currentRoom(): Room | null { return current; }
