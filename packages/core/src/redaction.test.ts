import { describe, expect, it } from "vitest";
import { redactText } from "./index.js";

describe("redaction engine", () => {
  it("masks common secrets while keeping a useful preview report", () => {
    const openAiKey = `sk-${"a".repeat(48)}`;
    const githubToken = `ghp_${"b".repeat(36)}`;
    const input = [
      "email: talha@example.com",
      `openai key: ${openAiKey}`,
      `github token: ${githubToken}`,
      "home=/home/itolkien/Projects/context-passport",
    ].join("\n");

    const result = redactText(input);

    expect(result.text).not.toContain("talha@example.com");
    expect(result.text).not.toContain(openAiKey);
    expect(result.text).not.toContain(githubToken);
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

  it("masks generic API key and secret assignments used in demos", () => {
    const input = [
      "API_KEY=sk-123...wxyz",
      "password: correct-horse-battery-staple",
      "token = demo_token_1234567890",
    ].join("\n");

    const result = redactText(input);

    expect(result.text).not.toContain("sk-123...wxyz");
    expect(result.text).not.toContain("correct-horse-battery-staple");
    expect(result.text).not.toContain("demo_token_1234567890");
    expect(result.text).toContain("[REDACTED:generic_secret]");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "generic_secret",
      "generic_secret",
      "generic_secret",
    ]);
  });

  it("masks high-risk provider credentials used by AI apps", () => {
    const join = (...parts: string[]) => parts.join("");
    const secrets = {
      awsAccessKey: join("AK", "IA", "IOSFODNN7EXAMPLE"),
      awsSecretKey: join("wJalr", "XUtnFEMI/K7MDENG/bPxRfiCY", "EXAMPLEKEY"),
      stripeSecretKey: join("sk", "_live_", "1234567890abcdefghijklmnopqrstuv"),
      stripeRestrictedKey: join("rk", "_live_", "1234567890abcdefghijklmnopqrstuv"),
      anthropicApiKey: join("sk-ant-", "api03-", "a".repeat(95), "AA"),
      googleApiKey: join("AI", "za", "SyA1234567890abcdefghijklmnopqrstuvwx"),
      jwt: join(
        "eyJ",
        "hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        ".eyJ",
        "zdWIiOiIxMjM0NTY3ODkwIn0",
        ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      ),
      privateKey: [
        join("-----BEGIN ", "PRIVATE KEY-----"),
        "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDdemo",
        join("-----END ", "PRIVATE KEY-----"),
      ].join("\n"),
    };
    const input = [
      `AWS_ACCESS_KEY_ID=${secrets.awsAccessKey}`,
      `AWS_SECRET_ACCESS_KEY=${secrets.awsSecretKey}`,
      `STRIPE_SECRET_KEY=${secrets.stripeSecretKey}`,
      `STRIPE_RESTRICTED_KEY=${secrets.stripeRestrictedKey}`,
      `ANTHROPIC_API_KEY=${secrets.anthropicApiKey}`,
      `GOOGLE_API_KEY=${secrets.googleApiKey}`,
      `JWT=${secrets.jwt}`,
      secrets.privateKey,
    ].join("\n");

    const result = redactText(input);

    for (const secret of Object.values(secrets)) {
      expect(result.text).not.toContain(secret);
    }
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "private_key",
      "aws_access_key_id",
      "aws_secret_access_key",
      "stripe_key",
      "stripe_key",
      "anthropic_api_key",
      "google_api_key",
      "jwt",
    ]);
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
