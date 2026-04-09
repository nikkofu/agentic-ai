import { describe, expect, it } from "vitest";

import { classifyRuntimeOutput } from "../../src/core/orchestrator";

describe("runtime invalid output classification", () => {
  it("classifies xml-like pseudo tool text as invalid_protocol", () => {
    const classification = classifyRuntimeOutput({
      envelope: {
        output_text: "<tool_call><function=web_search></function></tool_call>",
        invalid_tool_call_text: true
      },
      rawOutputText: "<tool_call><function=web_search></function></tool_call>",
      requiresVerification: false
    });

    expect(classification.kind).toBe("invalid_protocol");
    expect(classification.recoverable).toBe(true);
  });

  it("classifies an empty runtime response as empty_delivery", () => {
    const classification = classifyRuntimeOutput({
      envelope: {},
      rawOutputText: "",
      requiresVerification: false
    });

    expect(classification.kind).toBe("empty_delivery");
    expect(classification.recoverable).toBe(true);
  });

  it("classifies missing verification as verification_missing", () => {
    const classification = classifyRuntimeOutput({
      envelope: {
        final_result: "draft article",
        verification: []
      },
      rawOutputText: "{\"final_result\":\"draft article\"}",
      requiresVerification: true
    });

    expect(classification.kind).toBe("verification_missing");
    expect(classification.recoverable).toBe(false);
  });
});
