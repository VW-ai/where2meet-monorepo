export interface SSEMessage {
  event: string;
  data: string;
  id: string;
}

export function createSSEParser(
  onMessage: (message: SSEMessage) => void
): (chunk: Uint8Array) => void {
  const decoder = new TextDecoder();
  let buffer = '';
  let id = '';

  return (chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEventType: string | undefined;
    let currentData: string | undefined;

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEventType = line.slice(7);
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);
      } else if (line.startsWith('id: ')) {
        id = line.slice(4);
      } else if (line === '' && currentData) {
        onMessage({ event: currentEventType ?? 'message', data: currentData, id });
        currentData = undefined;
        currentEventType = undefined;
      }
    }
  };
}
