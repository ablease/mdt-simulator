// Reads a server-sent events stream and calls onData with the payload of each `data:` line.
// Anything thrown by onData stops the read and rejects.
export async function readSSE(response: Response, onData: (data: string) => void): Promise<void> {
  const reader = response.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, "");
      buf = buf.slice(i + 1);
      if (line.startsWith("data:")) onData(line.slice(5).trim());
    }
  }
  if (buf.startsWith("data:")) onData(buf.slice(5).trim());
}
