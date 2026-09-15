import { defineConfig } from "vitepress";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  title: "OpenWolf",
  description:
    "Local project memory and context tools for coding agents. Continue saved work, find relevant code and review recorded token usage.",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/wolf.svg" }],
    ["link", { rel: "canonical", href: "https://openwolf.com" }],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
    ],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
    ],
    // Open Graph
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:url", content: "https://openwolf.com" }],
    ["meta", { property: "og:site_name", content: "OpenWolf" }],
    [
      "meta",
      {
        property: "og:title",
        content: "OpenWolf: project memory and context tools for coding agents",
      },
    ],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Local project memory and context tools for coding agents. Continue saved work, find relevant code and review recorded token usage.",
      },
    ],
    // Twitter Card
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        name: "twitter:title",
        content: "OpenWolf: project memory and context tools for coding agents",
      },
    ],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Local project memory and context tools for coding agents. Continue saved work, find relevant code and review recorded token usage.",
      },
    ],
    // Additional SEO
    ["meta", { name: "author", content: "Dr. Farhan Palathinkal, Cytostack" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "project memory, agent memory, context engineering, claude code, codex, opencode, cursor, gemini cli, antigravity, token usage, token tracking, context management, open source, developer tools",
      },
    ],
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  themeConfig: {
    logo: "/wolf.svg",
    siteTitle: "OpenWolf",
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "How It Works", link: "/how-it-works" },
      { text: "Commands", link: "/commands" },
      { text: "Config", link: "/configuration" },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is OpenWolf?", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
        ],
      },
      {
        text: "Core Concepts",
        items: [
          { text: "How It Works", link: "/how-it-works" },
          { text: "Hooks", link: "/hooks" },
          { text: "Dashboard", link: "/dashboard" },
        ],
      },
      {
        text: "Features",
        items: [
          { text: "Handover and recovery", link: "/claude-codex-handoff-plan" },
          { text: "Session activity", link: "/session-visibility-plan" },
          { text: "Automatic updates", link: "/automatic-updates" },
          { text: "Interface review", link: "/reframe" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Commands", link: "/commands" },
          { text: "Configuration", link: "/configuration" },
          { text: "Update & Restore", link: "/updating" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "Operations", link: "/repair-operations" },
          { text: "2.5.2 release checks", link: "/release-2.5.2" },
          { text: "Issue and contributor audit", link: "/audit/README" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/cytostack/openwolf" },
    ],
    footer: {
      message: 'AGPL-3.0 · Made by <a href="https://github.com/cytostack" target="_blank">Cytostack</a>',
      copyright: 'Copyright 2026 Cytostack Pvt Ltd',
    },
    search: {
      provider: "local",
    },
  },
  appearance: "dark",
  markdown: {
    lineNumbers: false,
  },
});
