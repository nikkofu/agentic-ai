import { trace, metrics } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

export const tracer = trace.getTracer("agentic-runtime");
export const meter = metrics.getMeter("agentic-runtime");

let sdk: NodeSDK | null = null;

export async function initTelemetry() {
  if (sdk) return;

  sdk = new NodeSDK({
    // @ts-ignore - Workaround for OTel SDK type inconsistencies in tsc
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "agentic-ai",
      [ATTR_SERVICE_VERSION]: "1.0.0",
    }),
    traceExporter: new ConsoleSpanExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
    }),
  });

  sdk.start();

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
    await sdk.shutdown();
    sdk = null;
  }
}
