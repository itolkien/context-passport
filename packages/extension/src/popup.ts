type PageDetails = {
  title: string;
  url: string;
  selection?: string;
};

declare const browser: {
  tabs: {
    query(query: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number; title?: string; url?: string }>>;
  };
  scripting: {
    executeScript(input: {
      target: { tabId: number };
      func: () => string;
    }): Promise<Array<{ result?: string }>>;
  };
};

type CapturePayload = {
  title: string;
  text: string;
};

type CaptureResponse = {
  bundleId: string;
  path: string;
};

type FetchLike = (input: string, init: RequestInit) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;

const DAEMON_CAPTURE_URL = "http://127.0.0.1:17345/capture/note";

export function createCapturePayload(details: PageDetails): CapturePayload {
  const selectedText = details.selection?.trim();
  const text = selectedText && selectedText.length > 0 ? selectedText : "No text selection captured.";
  return {
    title: details.title || details.url,
    text: [`# ${details.title || details.url}`, "", `Source: ${details.url}`, "", text].join("\n"),
  };
}

export async function sendCaptureToDaemon(
  payload: CapturePayload,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<CaptureResponse> {
  const response = await fetchImpl(DAEMON_CAPTURE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Context Passport daemon rejected capture: HTTP ${response.status ?? "unknown"}`);
  }
  return (await response.json()) as CaptureResponse;
}

async function captureActiveTab(): Promise<void> {
  const status = document.querySelector<HTMLElement>("#status");
  const button = document.querySelector<HTMLButtonElement>("#capture");
  setStatus(status, "Capturing...");
  if (button) {
    button.disabled = true;
  }

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id || !tab.url) {
      throw new Error("No active tab available");
    }

    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? "",
    });
    const payload = createCapturePayload({
      title: tab.title ?? tab.url,
      url: tab.url,
      selection: result,
    });
    const saved = await sendCaptureToDaemon(payload);
    setStatus(status, `Saved: ${saved.bundleId}`);
  } catch (error) {
    setStatus(status, error instanceof Error ? error.message : String(error));
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function setStatus(element: HTMLElement | null, message: string): void {
  if (element) {
    element.textContent = message;
  }
}

if (typeof document !== "undefined") {
  document.querySelector<HTMLButtonElement>("#capture")?.addEventListener("click", () => {
    void captureActiveTab();
  });
}
