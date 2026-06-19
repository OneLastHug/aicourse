import { jobManager } from "@/lib/server/jobs";
import type { ProgressEvent } from "repo2learn/src/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generations can take minutes; keep the stream open generously.
export const maxDuration = 600;

function isTerminal(e: ProgressEvent): boolean {
  return (e.type === "stage" && e.stage === "done") || e.type === "error";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = jobManager.get(id);
  if (!state) return new Response("job not found", { status: 404 });

  const emitter = jobManager.emitter(id)!;
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (e: ProgressEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* client gone */
        }
      };

      // Replay history.
      for (const e of state.events) send(e);
      if (state.status === "done" || state.status === "error") {
        controller.close();
        return;
      }

      const onEvent = (e: ProgressEvent) => {
        send(e);
        if (isTerminal(e)) {
          cleanup();
          controller.close();
        }
      };
      function cleanup() {
        emitter.off("event", onEvent);
        clearInterval(pinger);
      }
      emitter.on("event", onEvent);
      const pinger = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      /* listeners are cleaned in start on terminal; nothing extra here */
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
