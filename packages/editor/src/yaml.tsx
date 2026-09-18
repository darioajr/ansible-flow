import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { loader } from "@monaco-editor/react";
export default function Yaml({
  code,
  assetBase,
  onChange,
}: {
  code: string;
  assetBase: string;
  onChange?: (text: string) => void;
}) {
  loader.config({ paths: { vs: `${assetBase}/vs` } });
  return (
    <CodeEditor
      code={code}
      language={Language.yaml}
      isReadOnly={!onChange}
      onChange={onChange}
      isLineNumbersVisible
      isMinimapVisible={false}
      isCopyEnabled
      height="100%"
    />
  );
}
