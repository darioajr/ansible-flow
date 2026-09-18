import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: [
    "@visual-ansible/air",
    "@visual-ansible/schemas",
    "@visual-ansible/generator",
    "@visual-ansible/parser",
    "@visual-ansible/validator",
    "@visual-ansible/module-metadata",
    "@visual-ansible/editor",
  ],
  experimental: {
    optimizePackageImports: [
      "@patternfly/react-core",
      "@patternfly/react-icons",
    ],
  },
};
export default config;
