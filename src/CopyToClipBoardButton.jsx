import React, { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

function CopyToClipBoardButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500); // Reset the state after 1.5 seconds
  };

  return (
    <div>
      <CopyToClipboard text={text} onCopy={handleCopy}>
        <button className="btn btn-secondary">
          {copied ? "Copied" : "Copy to Clipboard"}
        </button>
      </CopyToClipboard>
    </div>
  );
}

export default CopyToClipBoardButton;
