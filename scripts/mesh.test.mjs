import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { createMesh } from '../assets/js/session/mesh.js';

/** A stand-in RTCPeerConnection: enough to watch what the mesh asks of it. */
function fakeRTC() {
  const made = [];
  class FakePC {
    constructor(config) {
      this.config = config;
      this.closed = false;
      this.connectionState = 'new';
      made.push(this);
    }
    createDataChannel() {
      return { readyState: 'connecting', send() {} };
    }
    async createOffer() {
      return { type: 'offer', sdp: 'offer' };
    }
    async createAnswer() {
      return { type: 'answer', sdp: 'answer' };
    }
    async setLocalDescription(d) {
      this.localDescription = { toJSON: () => d };
    }
    async setRemoteDescription(d) {
      this.remoteDescription = d;
    }
    async addIceCandidate() {}
    close() {
      this.closed = true;
    }
  }
  return { RTC: FakePC, made };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('a fresh offer gets a fresh connection on the answering side, through the relay', async () => {
  const { RTC, made } = fakeRTC();
  const sent = [];
  const mesh = createMesh({ me: 'b', RTC, signal: (_to, data) => sent.push(data), onMessage() {} });
  await mesh.signal('a', { sdp: { type: 'offer', sdp: 'one' } });
  assert.equal(made.length, 1);
  assert.equal(made[0].config.iceTransportPolicy, 'all');
  await mesh.signal('a', { sdp: { type: 'offer', sdp: 'two' } });
  assert.equal(made.length, 2, 'the second offer is not applied to the first connection');
  assert.equal(made[0].closed, true);
  assert.equal(made[1].config.iceTransportPolicy, 'relay');
  assert.equal(sent.filter((d) => d.sdp?.type === 'answer').length, 2);
  mesh.close();
});

test('a connection that has not opened in time is retried by the offerer, through the relay', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { RTC, made } = fakeRTC();
    const offers = [];
    const mesh = createMesh({ me: 'a', RTC, signal: (_to, data) => data.sdp && offers.push(data.sdp), onMessage() {} });
    mesh.connect('b');
    await flush();
    assert.equal(offers.length, 1);
    assert.equal(made[0].config.iceTransportPolicy, 'all');
    mock.timers.tick(12_000);
    assert.equal(made[0].closed, true, 'the stalled connection is dropped');
    mock.timers.tick(3_000);
    await flush();
    assert.equal(made.length, 2);
    assert.equal(made[1].config.iceTransportPolicy, 'relay');
    assert.equal(offers.length, 2);
    mesh.close();
  } finally {
    mock.timers.reset();
  }
});

test('players who left are dropped, so a return starts a new connection', async () => {
  const { RTC, made } = fakeRTC();
  const mesh = createMesh({ me: 'a', RTC, signal() {}, onMessage() {} });
  mesh.connect('b');
  mesh.connect('c');
  mesh.keep(['c']);
  assert.equal(mesh.state('b'), 'none');
  assert.equal(mesh.state('c'), 'connecting');
  mesh.connect('b');
  assert.equal(made.length, 3);
  mesh.close();
});

test('switching to relay only starts every connection over through the relay, on both sides', async () => {
  const { RTC, made } = fakeRTC();
  const sent = [];
  const mesh = createMesh({ me: 'a', RTC, signal: (to, data) => sent.push([to, data]), onMessage() {} });
  mesh.connect('b');
  await flush();
  assert.equal(made[0].config.iceTransportPolicy, 'all');
  mesh.relayOnly(true);
  await flush();
  assert.equal(made[0].closed, true);
  assert.equal(made[1].config.iceTransportPolicy, 'relay');
  assert.deepEqual(sent.filter(([, d]) => d.restart), [['b', { restart: true }]]);
  assert.equal(sent.filter(([, d]) => d.sdp?.type === 'offer').length, 2, 'the offerer offers again');

  const { RTC: RTC2, made: made2 } = fakeRTC();
  const other = createMesh({ me: 'b', RTC: RTC2, signal() {}, onMessage() {} });
  await other.signal('a', { sdp: { type: 'offer', sdp: 'one' } });
  await other.signal('a', { restart: true });
  assert.equal(made2[0].closed, true, 'asked to restart, the other side drops its connection too');
  assert.equal(made2.length, 2);
  mesh.close();
  other.close();
});

