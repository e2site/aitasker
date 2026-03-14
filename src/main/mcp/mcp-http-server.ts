/*
Purpose: Host the local MCP server over Streamable HTTP inside the Electron main process on a stable local port.
Out of scope: Tool business logic, renderer IPC, and provider prompt construction.
*/
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./create-mcp-server";
import type { AppService } from "../services/app-service";
import type { DevLogger } from "../services/dev-logger";

interface SessionContext {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const DEFAULT_MCP_PORT = 39291;

function resolveMcpPort(): number {
  const rawPort = process.env.AITASKER_MCP_PORT;

  if (!rawPort) {
    return DEFAULT_MCP_PORT;
  }

  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`AITASKER_MCP_PORT must be an integer between 1 and 65535. Received: ${rawPort}`);
  }

  return port;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");

  return text ? JSON.parse(text) : undefined;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function getSessionId(rawHeader: string | string[] | undefined): string | undefined {
  return Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
}

export class McpHttpServer {
  private readonly sessions = new Map<string, SessionContext>();
  private httpServer: Server | null = null;
  private port: number | null = null;

  constructor(
    private readonly appService: AppService,
    private readonly logger: DevLogger
  ) {}

  get endpoint(): string | null {
    return this.port ? `http://127.0.0.1:${this.port}/mcp` : null;
  }

  get isRunning(): boolean {
    return this.httpServer !== null && this.port !== null;
  }

  async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    const port = resolveMcpPort();

    this.httpServer = createServer(async (request, response) => {
      if (!request.url?.startsWith("/mcp")) {
        response.statusCode = 404;
        response.end("Not Found");
        return;
      }

      try {
        if (request.method === "POST") {
          const body = await readJsonBody(request);
          await this.handlePostRequest(request, response, body);
          return;
        }

        if (request.method === "GET" || request.method === "DELETE") {
          await this.handleSessionRequest(request, response);
          return;
        }

        response.statusCode = 405;
        response.end("Method Not Allowed");
      } catch (error) {
        this.logger.error("mcp", "HTTP request failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        if (!response.headersSent) {
          writeJson(response, 500, {
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error"
            },
            id: null
          });
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer?.once("error", reject);
      this.httpServer?.listen(port, "127.0.0.1", () => {
        const address = this.httpServer?.address();

        if (!address || typeof address === "string") {
          reject(new Error("Could not determine MCP server port."));
          return;
        }

        this.port = address.port;
        this.logger.info("mcp", "HTTP server started", { endpoint: this.endpoint });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.server.close();
      await session.transport.close();
    }
    this.sessions.clear();

    if (!this.httpServer) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    this.httpServer = null;
    this.port = null;
  }

  private async handlePostRequest(
    request: IncomingMessage,
    response: ServerResponse,
    body: unknown
  ): Promise<void> {
    const sessionId = getSessionId(request.headers["mcp-session-id"]);

    if (!sessionId && isInitializeRequest(body)) {
      const server = createMcpServer(this.appService, this.logger);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          this.sessions.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
      if (transport.sessionId) {
        this.sessions.set(transport.sessionId, { server, transport });
      }
      await transport.handleRequest(request, response, body);
      if (transport.sessionId) {
        this.sessions.set(transport.sessionId, { server, transport });
      }
      return;
    }

    await this.handleSessionRequest(request, response, body, sessionId);
  }

  private async handleSessionRequest(
    request: IncomingMessage,
    response: ServerResponse,
    body?: unknown,
    sessionIdHeader?: string
  ): Promise<void> {
    const sessionId = sessionIdHeader ?? getSessionId(request.headers["mcp-session-id"]);

    if (!sessionId) {
      writeJson(response, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "MCP session id is required."
        },
        id: null
      });
      return;
    }

    const session = this.sessions.get(sessionId);

    if (!session) {
      writeJson(response, 404, {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unknown MCP session."
        },
        id: null
      });
      return;
    }

    await session.transport.handleRequest(request, response, body);
  }
}
