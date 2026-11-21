import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// The page may only load its own files and only talk to the two AI providers. Trusted Types
// means script URLs can only come from the "pdfmake" policy in src/export/pdf.ts.
// GitHub Pages can't send headers, so this goes in a <meta> tag (which can't set frame-ancestors).
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.openai.com https://api.anthropic.com",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "trusted-types pdfmake",
  "require-trusted-types-for 'script'",
].join("; ");

// Only on build: the dev server injects inline styles for hot reload, which this policy blocks.
const csp = (): Plugin => ({
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
});

export default defineConfig({
  base: "/",
  plugins: [react(), csp()],
  // Emit every asset as a file. Vite otherwise inlines small fonts as data: URLs, which font-src 'self' blocks.
  build: { assetsInlineLimit: 0 },
});
