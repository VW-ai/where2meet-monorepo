export interface SSEMessage {
  event: string;
  data: string;
  id: string;
}

// https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
export function createSSEParser(
  onMessage: (message: SSEMessage) => void
): (chunk: Uint8Array) => void {
  const decoder = new TextDecoder();
  let partialLine = '';
  let endedWithCR = false;
  let event = '';
  let data: string[] = [];
  let id = '';
  let ready: SSEMessage[] = [];

  function readLine(line: string) {
    if (line === '') {
      if (data.length > 0) ready.push({ event: event || 'message', data: data.join('\n'), id });
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

    const lines = (partialLine + text).split(/\r\n|\r|\n/);
    partialLine = lines.pop() ?? '';
    lines.forEach(readLine);

    const messages = ready;
    ready = [];
    messages.forEach(onMessage);
  };
}
