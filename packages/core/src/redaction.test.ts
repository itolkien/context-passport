import { describe, expect, it } from "vitest";
import { redactText } from "./index.js";

describe("redaction engine", () => {
  it("masks common secrets while keeping a useful preview report", () => {
    const input = [
      "email: talha@example.com",
      "apiKey = \"sk-1234567890abcdefghijklmnopqrstuvwxyz\"",
      "github token: ghp_1234567890abcdefghijklmnopqrstuvwxyz123456",
      "home=/home/itolkien/Projects/context-passport",
    ].join("\n");

    const result = redactText(input);

    expect(result.text).not.toContain("talha@example.com");
    expect(result.text).not.toContain("sk-1234567890abcdefghijklmnopqrstuvwxyz");
    expect(result.text).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyz123456");
    expect(result.text).not.toContain("/home/itolkien");
    expect(result.text).toContain("[REDACTED:email]");
    expect(result.text).toContain("[REDACTED:openai_api_key]");
    expect(result.text).toContain("[REDACTED:github_token]");
    expect(result.text).toContain("[REDACTED:local_path]");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "github_token",
      "openai_api_key",
      "email",
      "local_path",
    ]);
    expect(result.findings[0]).toMatchObject({ replacement: "[REDACTED:github_token]" });
  });

  it("supports custom redaction rules without leaking matched values", () => {
    const result = redactText("customer id: cust_very_private_123", {
      customRules: [{ id: "customer_id", pattern: "cust_[a-z_]+_\\d+" }],
    });

    expect(result.text).toBe("customer id: [REDACTED:customer_id]");
    expect(result.findings).toEqual([
      {
        ruleId: "customer_id",
        label: "customer_id",
        start: 13,
        end: 34,
        replacement: "[REDACTED:customer_id]",
      },
    ]);
  });
});
