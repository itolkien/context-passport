import { describe, expect, it, vi } from "vitest";
import { createCapturePayload, sendCaptureToDaemon } from "./popup.js";

describe("extension popup", () => {
  it("builds a browser capture payload from page details", () => {
    expect(
      createCapturePayload({
        title: "Issue title",
        url: "https://github.com/org/repo/issues/1",
        selection: "Important stack trace",
      }),
    ).toEqual({
      title: "Issue title",
      text: "# Issue title\n\nSource: https://github.com/org/repo/issues/1\n\nImportant stack trace",
    });
  });

  it("posts captures to the local daemon", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bundleId: "abc", path: "/tmp/abc" }) });

    const result = await sendCaptureToDaemon({ title: "T", text: "Body" }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:17345/capture/note", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "T", text: "Body" }),
    });
    expect(result).toEqual({ bundleId: "abc", path: "/tmp/abc" });
  });
});
