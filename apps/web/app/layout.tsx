import type { Metadata } from "next";
import "@patternfly/react-core/dist/styles/base.css";
import "@xyflow/react/dist/style.css";
import "@visual-ansible/editor/style.css";
import "./globals.css";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: "Playbook Flow — Visual Ansible",
  description: "One visual Ansible engine for Web and VS Code.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
