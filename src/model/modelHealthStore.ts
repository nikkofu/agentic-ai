import fs from "node:fs";
import path from "node:path";

type ModelHealthState = {
  unhealthy: Record<string, { reason: string; ts: string }>;
};

export type ModelHealthStore = {
  isHealthy(model: string): boolean;
  markUnhealthy(model: string, reason: string): void;
  clear(model: string): void;
};

export function createInMemoryModelHealthStore(): ModelHealthStore {
  const unhealthy: Record<string, { reason: string; ts: string }> = {};

  return {
    isHealthy(model: string) {
      return !(model in unhealthy);
    },
    markUnhealthy(model: string, reason: string) {
      unhealthy[model] = { reason, ts: new Date().toISOString() };
    },
    clear(model: string) {
      delete unhealthy[model];
    }
  };
}

export function createFileModelHealthStore(
  filePath = path.resolve(process.cwd(), "data/model-health.json")
): ModelHealthStore {
  const readState = (): ModelHealthState => {
    if (!fs.existsSync(filePath)) {
      return { unhealthy: {} };
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as ModelHealthState;
    } catch {
      return { unhealthy: {} };
    }
  };

  const writeState = (state: ModelHealthState) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  };

  return {
    isHealthy(model: string) {
      const state = readState();
      return !(model in state.unhealthy);
    },
    markUnhealthy(model: string, reason: string) {
      const state = readState();
      state.unhealthy[model] = { reason, ts: new Date().toISOString() };
      writeState(state);
    },
    clear(model: string) {
      const state = readState();
      if (model in state.unhealthy) {
        delete state.unhealthy[model];
        writeState(state);
      }
    }
  };
}
