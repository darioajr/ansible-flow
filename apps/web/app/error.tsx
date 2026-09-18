"use client";
import { Alert, Button } from "@patternfly/react-core";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="info-page">
      <Alert
        isInline
        variant="danger"
        title="The workspace could not be loaded."
      >
        Check the server storage configuration.
      </Alert>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
