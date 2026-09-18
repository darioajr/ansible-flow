import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useDarkTheme } from "./theme";
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
  const dark = useDarkTheme();
  loader.config({ paths: { vs: `${assetBase}/vs` } });
  return (
    <CodeEditor
      code={code}
      isDarkTheme={dark}
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
