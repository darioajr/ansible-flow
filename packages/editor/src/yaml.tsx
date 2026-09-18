import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { loader } from "@monaco-editor/react";
export default function Yaml({
  code,
  assetBase,
}: {
  code: string;
  assetBase: string;
}) {
  loader.config({ paths: { vs: `${assetBase}/vs` } });
  return (
    <CodeEditor
      code={code}
      language={Language.yaml}
      isReadOnly
      isLineNumbersVisible
      isMinimapVisible={false}
      isCopyEnabled
      height="100%"
    />
  );
}
