"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  Label,
} from "@patternfly/react-core";
import {
  ProjectDiagramIcon,
  CogIcon,
  InfoCircleIcon,
} from "@patternfly/react-icons";
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Page
      className="app-shell"
      masthead={
        <Masthead>
          <MastheadMain>
            <MastheadBrand>
              <Link className="brand" href="/projects">
                <span className="brand-mark">⌘</span>playbook<span>flow</span>
              </Link>
            </MastheadBrand>
          </MastheadMain>
          <MastheadContent>
            <span className="masthead-tagline">
              Visual automation. Real Ansible.
            </span>
            <Label isCompact color="blue">
              Local workspace
            </Label>
            <span className="avatar">PF</span>
          </MastheadContent>
        </Masthead>
      }
      sidebar={
        <PageSidebar isSidebarOpen>
          <PageSidebarBody>
            <div className="nav-eyebrow">WORKSPACE</div>
            <Nav aria-label="Main navigation">
              <NavList>
                {(
                  [
                    ["/projects", "Projects", ProjectDiagramIcon],
                    ["/settings", "Settings", CogIcon],
                    ["/about", "About", InfoCircleIcon],
                  ] as const
                ).map(([href, title, Icon]) => (
                  <NavItem
                    key={href}
                    isActive={
                      pathname.startsWith(href) ||
                      (href === "/projects" && pathname.startsWith("/editor"))
                    }
                  >
                    <Link href={href}>
                      <Icon /> {title}
                    </Link>
                  </NavItem>
                ))}
              </NavList>
            </Nav>
            <div className="sidebar-footer">
              <i className="status-dot" /> Shared authoring engine
              <br />
              <small>Web + VS Code · v0.2</small>
            </div>
          </PageSidebarBody>
        </PageSidebar>
      }
    >
      {children}
    </Page>
  );
}
