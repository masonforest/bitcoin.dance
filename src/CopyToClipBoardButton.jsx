import React, { useState } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const CopyToClipboardButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    console.log("here")
    setCopied(true);
    setTimeout(() => setCopied(false), 1500); // Reset after 1.5 seconds
  };

  return (
    <CopyToClipboard text={text} onCopy={handleCopy}>
      <OverlayTrigger
        placement="top"
        overlay={
          <Tooltip id="tooltip-copy">
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Tooltip>
        }
      >
        <Button variant="outline-secondary">
          <i className="bi bi-clipboard"></i>
        </Button>
      </OverlayTrigger>
    </CopyToClipboard>
  );
};

export default CopyToClipboardButton;