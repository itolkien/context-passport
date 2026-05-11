import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Context Passport",
    description: "Capture AI-ready context bundles from the browser.",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: ["http://127.0.0.1:17345/*"],
  },
});
