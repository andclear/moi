export async function readTextResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return response.text();
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
            choices?: Array<{ delta?: { content?: string }; text?: string }>;
          };
          result += payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.text ?? "";
        } catch {
          result += data;
        }
      }
    }
  }

  return result;
}
