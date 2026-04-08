import { describe, it, expect } from "vitest";
import { EnvSecretProvider } from "../../src/core/secretProvider";

describe("EnvSecretProvider", () => {
  it("should retrieve secret from provided env record", async () => {
    const provider = new EnvSecretProvider({ MY_KEY: "super-secret" });
    expect(await provider.getSecret("MY_KEY")).toBe("super-secret");
  });

  it("should return null if secret is missing", async () => {
    const provider = new EnvSecretProvider({});
    expect(await provider.getSecret("NON_EXISTENT")).toBeNull();
  });
});
