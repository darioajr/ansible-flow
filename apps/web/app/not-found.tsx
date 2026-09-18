import Link from "next/link";
export default function NotFound() {
  return (
    <section className="info-page">
      <h1>Project not found</h1>
      <Link href="/projects">Return to projects</Link>
    </section>
  );
}
