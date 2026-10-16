export interface SSEMessage {
  event: string;
  data: string;
  id: string;
}

// Follows the HTML spec's event stream rules. A message can span any number of reads,
// so the line buffer and the message being built live across calls.
// `retry` is ignored: useEventStream owns reconnect timing, and the server never sends it.
export function createSSEParser(
  onMessage: (message: SSEMessage) => void
): (chunk: Uint8Array) => void {
  const decoder = new TextDecoder();
  let buffer = '';
  let endedWithCR = false;
  let event = '';
  let data: string[] = [];
  let id = '';

  function readLine(line: string) {
    if (line === '') {
      if (data.length > 0) onMessage({ event: event || 'message', data: data.join('\n'), id });
      event = '';
      data = [];
      return;
    }
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? '' : line.slice(colon + 1);
    const value = raw.startsWith(' ') ? raw.slice(1) : raw;

    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id' && !value.includes('\0')) id = value;
  }

  return (chunk) => {
    let text = decoder.decode(chunk, { stream: true });
    if (text === '') return;
    if (endedWithCR && text.startsWith('\n')) text = text.slice(1);
    endedWithCR = text.endsWith('\r');

    const lines = (buffer + text).split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(readLine);
  };
}
