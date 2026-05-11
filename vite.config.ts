import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const apiRoutes: Record<string, string> = {
  "/api/activate": "/api/activate.ts",
  "/api/llm": "/api/llm.ts",
  "/api/model-channel/status": "/api/model-channel/status.ts",
  "/api/admin/activation-codes": "/api/admin/activation-codes.ts",
  "/api/admin/login": "/api/admin/login.ts",
  "/api/admin/logout": "/api/admin/logout.ts",
  "/api/admin/model-channel": "/api/admin/model-channel.ts",
  "/api/admin/status": "/api/admin/status.ts",
};

function collectRequestBody(request: import("node:http").IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function createHeaders(headers: import("node:http").IncomingHttpHeaders) {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result.set(key, value.join(", "));
      continue;
    }
    if (value) {
      result.set(key, value);
    }
  }
  return result;
}

function localApiPlugin(): Plugin {
  return {
    name: "echo-local-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split("?")[0] ?? "";
        const modulePath = apiRoutes[pathname];
        if (!modulePath) {
          next();
          return;
        }

        try {
          const body =
            request.method === "GET" || request.method === "HEAD"
              ? undefined
              : await collectRequestBody(request);
          const fetchRequest = new Request(`http://127.0.0.1${request.url}`, {
            method: request.method,
            headers: createHeaders(request.headers),
            body,
          });
          const mod = (await server.ssrLoadModule(modulePath)) as {
            default: (request: Request) => Promise<Response>;
          };
          const fetchResponse = await mod.default(fetchRequest);

          response.statusCode = fetchResponse.status;
          fetchResponse.headers.forEach((value, key) => response.setHeader(key, value));
          response.end(Buffer.from(await fetchResponse.arrayBuffer()));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "本地 API 执行失败。",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [localApiPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
