import { trace, metrics } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics";
import * as resources from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

export const tracer = trace.getTracer("agentic-runtime");
export const meter = metrics.getMeter("agentic-runtime");

let sdk: NodeSDK | null = null;

export async function initTelemetry() {
  if (sdk) return;

  try {
    const ResourceConstructor = (resources as any).Resource || (resources as any).default?.Resource;

    if (typeof ResourceConstructor !== "function") {
      console.warn("Telemetry: Resource constructor not found, skipping SDK init");
      return;
    }

    sdk = new NodeSDK({
      resource: new ResourceConstructor({
        [ATTR_SERVICE_NAME]: "agentic-ai",
        [ATTR_SERVICE_VERSION]: "1.0.0",
      }),
      traceExporter: new ConsoleSpanExporter(),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
      }),
    });

    sdk.start();
  } catch (err) {
    console.error("Telemetry SDK failed to start:", err);
  }

  process.on("SIGTERM", async () => {
    try {
      await sdk?.shutdown();
    } finally {
      process.exit(0);
    }
  });
}

export async function shutdownTelemetry() {
  if (sdk) {
    try {
      await sdk.shutdown();
    } catch (err) {}
    sdk = null;
  }
}
