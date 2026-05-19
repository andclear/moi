export async function readTextResponse(
  response: Response,
  onDelta?: (delta: string, content: string) => void,
) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const text = await response.text();
    if (text) {
      onDelta?.(text, text);
    }
    return text;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let result = "";
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      result = appendStreamEvent(event, result, onDelta);
    }
  }

  if (buffer.trim()) {
    result = appendStreamEvent(buffer, result, onDelta);
  }

  return result;
}

function appendStreamEvent(
  event: string,
  current: string,
  onDelta?: (delta: string, content: string) => void,
) {
  let result = current;
  const dataLines = event
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, ""));

  for (const data of dataLines) {
    if (data === "[DONE]") {
      continue;
    }

    try {
      const payload = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string }; text?: string }>;
      };
      const delta =
        payload.choices?.[0]?.delta?.content ??
        payload.choices?.[0]?.message?.content ??
        payload.choices?.[0]?.text ??
        "";
      result += delta;
      if (delta) {
        onDelta?.(delta, result);
      }
    } catch {
      result += data;
      onDelta?.(data, result);
    }
  }

  return result;
}
