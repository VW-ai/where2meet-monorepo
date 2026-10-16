import { createSSEParser, type SSEMessage } from '@/shared/lib/sse-parser';

const encoder = new TextEncoder();

function parse(chunks: Array<string | Uint8Array>): SSEMessage[] {
  const messages: SSEMessage[] = [];
  const push = createSSEParser((message) => messages.push(message));
  for (const chunk of chunks) push(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
  return messages;
}

const RENAME_DATA =
  '{"event":{"id":"evt_1792167269143_bqAdVLMBseGmhgHK","title":"Café SSE test, split reads before fix","meetingTime":"2026-10-21T00:00:00.000Z","publishedAt":null,"publishedVenueId":null}}';
const RENAME = `event: event:updated\ndata: ${RENAME_DATA}\n\n`;
const RENAME_MESSAGE: SSEMessage = { event: 'event:updated', data: RENAME_DATA, id: '' };

describe('createSSEParser', () => {
  it('reads a message split into two reads at any byte', () => {
    const bytes = encoder.encode(RENAME);
    const dropped = [];
    for (let at = 1; at < bytes.length; at++) {
      const messages = parse([bytes.subarray(0, at), bytes.subarray(at)]);
      if (JSON.stringify(messages) !== JSON.stringify([RENAME_MESSAGE])) dropped.push(at);
    }
    expect(dropped).toEqual([]);
  });

  it('reads a message that arrives one byte per read', () => {
    const bytes = encoder.encode(RENAME);
    const chunks = Array.from(bytes, (_, i) => bytes.subarray(i, i + 1));
    expect(parse(chunks)).toEqual([RENAME_MESSAGE]);
  });

  it('reads two messages from one read, in order', () => {
    const changed =
      '{"eventId":"evt_1792167269143_bqAdVLMBseGmhgHK","seq":1,"venueId":"ChIJme4A6d5bwokR7QwUdTNRp5E","voterId":"686b6702-ab7e-4130-9ced-4b9a41dcf54f","delta":1,"voteCount":1,"totalVotes":1,"updatedAt":"2026-10-16T17:58:31.100Z"}';
    const statistics =
      '{"eventId":"evt_1792167269143_bqAdVLMBseGmhgHK","seq":2,"venues":[{"venueId":"ChIJme4A6d5bwokR7QwUdTNRp5E","voteCount":1,"voterIds":["686b6702-ab7e-4130-9ced-4b9a41dcf54f"],"voterNames":["686b6702-ab7e-4130-9ced-4b9a41dcf54f"]}],"totalVotes":1,"updatedAt":"2026-10-16T17:58:31.104Z"}';
    expect(
      parse([
        `event: vote:changed\ndata: ${changed}\n\nevent: vote:statistics\ndata: ${statistics}\n\n`,
      ])
    ).toEqual([
      { event: 'vote:changed', data: changed, id: '' },
      { event: 'vote:statistics', data: statistics, id: '' },
    ]);
  });

  it('accepts CRLF and CR line ends, even with CRLF split across reads', () => {
    expect(
      parse(['event: heartbeat\r\ndata: one\r', '\ndata: two\r\n\r\n', 'data: three\r\r'])
    ).toEqual([
      { event: 'heartbeat', data: 'one\ntwo', id: '' },
      { event: 'message', data: 'three', id: '' },
    ]);
  });

  it('joins several data lines with a newline', () => {
    expect(parse(['data: first\ndata:second\ndata\n\n'])).toEqual([
      { event: 'message', data: 'first\nsecond\n', id: '' },
    ]);
  });

  it('skips comments and unknown fields, keeps the last id, and ignores retry', () => {
    expect(
      parse([
        ': keep-alive\n\n',
        'id: 7\nretry: 3000\nevent: close\ncolor: red\ndata: {"reason":"server_shutdown"}\n\n',
        'event: heartbeat\ndata: {}\n\n',
      ])
    ).toEqual([
      { event: 'close', data: '{"reason":"server_shutdown"}', id: '7' },
      { event: 'heartbeat', data: '{}', id: '7' },
    ]);
  });

  it('starts the next read clean after the callback throws', () => {
    const messages: SSEMessage[] = [];
    const push = createSSEParser((message) => {
      if (message.data === 'one') throw new Error('handler broke');
      messages.push(message);
    });
    expect(() => push(encoder.encode('data: one\n\ndata: two\n\n'))).toThrow('handler broke');
    push(encoder.encode('data: three\n\n'));
    expect(messages).toEqual([{ event: 'message', data: 'three', id: '' }]);
  });

  it('forgets the event type when a blank line ends a message with no data', () => {
    expect(parse(['event: vote:changed\n\ndata: {}\n\n'])).toEqual([
      { event: 'message', data: '{}', id: '' },
    ]);
  });
});
