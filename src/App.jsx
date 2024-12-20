import React, { useMemo, useEffect, useRef, useState } from "react";
import * as borsh from "borsh";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";
import * as secp256k1 from "@noble/secp256k1";
import { useInterval } from "react-use";
import { QRCodeSVG } from "qrcode.react";
import { sha256 } from "@noble/hashes/sha2";
import StableNetwork from "./StableNetwork";
import { wordlist } from "@scure/bip39/wordlists/english";
import { base64urlnopad } from "@scure/base";
import CopyToClipboardButton from "./CopyToClipBoardButton";
import * as bip39 from "@scure/bip39";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { HDKey } from "@scure/bip32";
import Col from "react-bootstrap/Col";
import Nav from "react-bootstrap/Nav";
import Row from "react-bootstrap/Row";
import Tab from "react-bootstrap/Tab";
import "./App.css";

let USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatUsd(value) {
  let USD = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  return USD.format(new Number(value / 100n) + new Number(value % 100n) / 100);
}
const transactionSchema = BorshSchema.Enum({
  Transfer: BorshSchema.Struct({
    nonce: BorshSchema.i64,
    token_type: BorshSchema.Enum({
      Snt: BorshSchema.Unit,
      Usd: BorshSchema.Unit,
    }),
    to: BorshSchema.Array(BorshSchema.u8, 33),
    value: BorshSchema.i64,
  }),
});

const stable = new StableNetwork({ development: import.meta.env.DEV });

function App() {
  const [entropy, setEntropy] = useState(window.location.search.slice(1));
  const [inputValue, setInputValue] = useState("");
  const [paymentLink, setPaymentLink] = useState(null);
  const [paymentLinkBalance, setPaymentLinkBalance] = useState(0n);

  const [usdBalance, setUsdBalance] = useState(0n);
  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const [mnemonic, setMnemonic] = useState(localStorage.mnemonic || "");

  const sweepPaymentLink = async () => {
    const { privateKey, publicKey: temporaryPublicKey } = HDKey.fromMasterSeed(
      base64urlnopad.decode(entropy),
    ).derive("m/84'/0'/0'");
    const { publicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    let value = await stable.getBalance(temporaryPublicKey, "usd");

    const transaction = borshSerialize(transactionSchema, {
      Transfer: {
        nonce: 0,
        token_type: { Usd: {} },
        to: publicKey,
        value,
      },
    });
    const signature = await secp256k1.signAsync(
      sha256(transaction),
      privateKey,
    );
    await stable.postTransaction(
      secp256k1.etc.concatBytes(
        transaction,
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    );
    history.pushState(
      {},
      "",
      window.location.origin + window.location.pathname,
    );
    setEntropy(null);
  };

  //   if (window.location.search) {
  //     sweepPaymentLink(base64urlnopad.decode(window.location.search.slice(1)));
  //   }
  // }, []);
  useEffect(() => {
    if (!mnemonic) {
      const newMnemonic = bip39.generateMnemonic(wordlist);
      localStorage.mnemonic = newMnemonic;
      setMnemonic(newMnemonic);
    }
  }, [mnemonic]);

  useInterval(async () => {
    if (!entropy) {
      return;
    }
    const { publicKey: temporaryPublicKey } = HDKey.fromMasterSeed(
      base64urlnopad.decode(entropy),
    ).derive("m/84'/0'/0'");
    setPaymentLinkBalance(await stable.getBalance(temporaryPublicKey, "usd"));
  }, 1000);

  useInterval(async () => {
    const { publicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    console.log(Buffer.from(publicKey).toString("hex"));
    let usdBalance = await stable.getBalance(publicKey, "usd");
    setUsdBalance(usdBalance);
  }, 1000);

  async function send(e) {
    e.preventDefault();
    const temporaryMnemonic = bip39.generateMnemonic(wordlist);
    const { publicKey: temporaryPublicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(temporaryMnemonic, wordlist),
    ).derive("m/84'/0'/0'");

    const temporaryEntropy = bip39.mnemonicToEntropy(
      temporaryMnemonic,
      wordlist,
    );
    const { privateKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    const value = Math.round(parseFloat(inputValue * 100));
    const transaction = borshSerialize(transactionSchema, {
      Transfer: {
        nonce: 0,
        token_type: { Usd: {} },
        to: temporaryPublicKey,
        value,
      },
    });
    const signature = await secp256k1.signAsync(
      sha256(transaction),
      privateKey,
    );
    stable.postTransaction(
      secp256k1.etc.concatBytes(
        transaction,
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    );
    setPaymentLink(
      `${window.location.href}?${base64urlnopad.encode(temporaryEntropy)}`,
    );
    setShowQrCodeModal(true);
  }
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);

  return (
    <>
      <Tab.Container id="left-tabs-example" defaultActiveKey="send">
        <Tab.Content>
          <Tab.Pane eventKey="deposit">
            {" "}
            <Deposit />
          </Tab.Pane>
          <Tab.Pane eventKey="withdraw">
            {" "}
            <Withdraw />
          </Tab.Pane>
          <Tab.Pane eventKey="send">
            <h4 className="my-2 text-center fw-bold section-title">
              {" "}
              Balance: {formatUsd(usdBalance)}
            </h4>
            <form onSubmit={send}>
              <div className="form-floating">
                <input
                  onChange={handleChange}
                  value={inputValue}
                  type="text"
                  className="form-control rounded-3"
                  id="floatingInputName"
                  placeholder="Name"
                />
                <label htmlFor="floatingInputName">Amount</label>
              </div>
              <input
                className="btn btn-success w-100 mt-4"
                type="submit"
                value="Create Payment"
              />
            </form>
            {paymentLink && (
              <>
                <div className="d-flex flex-row mt-2">
                  <input
                    className="form-control rounded-3"
                    value={paymentLink}
                    readOnly
                  />
                  <CopyToClipboardButton text={paymentLink} />
                  <button
                    className="btn btn-secondary mx-2"
                    onClick={() => setShowQrCodeModal(true)}
                  >
                    Show QR Code
                  </button>
                </div>
              </>
            )}
          </Tab.Pane>
        </Tab.Content>
        <footer className="page-footer fixed-bottom border-top d-flex align-items-center">
          <nav className="navbar navbar-expand p-0 flex-grow-1">
            <div className="navbar-nav align-items-center justify-content-between w-100">
              <Nav.Link eventKey="deposit">
                <div className="d-flex flex-column align-items-center">
                  <div className="icon">
                    <i className="bi bi-currency-dollar"></i>
                  </div>
                  <div className="name">Deposit</div>
                </div>
              </Nav.Link>
              <Nav.Link eventKey="withdraw">
                <div className="d-flex flex-column align-items-center">
                  <div className="icon">
                    <i className="bi bi-currency-bitcoin"></i>
                  </div>
                  <div className="name">Withdraw</div>
                </div>
              </Nav.Link>
              <Nav.Link eventKey="send">
                <div className="d-flex flex-column align-items-center">
                  <div className="icon">
                    <i className="bi bi-arrow-up-right-square"></i>
                  </div>
                  <div className="name">Send</div>
                </div>
              </Nav.Link>
            </div>
          </nav>
        </footer>
      </Tab.Container>
      <Modal
        show={showQrCodeModal}
        fullscreen={"md-down"}
        onHide={() => {
          setShowQrCodeModal(false);
          setInputValue("");
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Sending{" "}
            {inputValue &&
              formatUsd(BigInt((parseFloat(inputValue) || 0) * 100))}
            ...
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <QRCodeSVG
            width="100%"
            height="100%"
            size={400}
            value={paymentLink}
          />
        </Modal.Body>
      </Modal>

      <Modal
        show={entropy}
        fullscreen={"md-down"}
        onHide={() => setShowQrCodeModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Sending...</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <button
            onClick={() => sweepPaymentLink()}
            className="btn btn-success btn-xlg w-100"
          >
            <title>
              Accept {formatUsd(paymentLinkBalance)} on the Stable Network
            </title>
            Accept {formatUsd(paymentLinkBalance)}
          </button>
        </Modal.Body>
      </Modal>

      {/* <footer className="page-footer fixed-bottom border-top d-flex align-items-center">
        <nav className="navbar navbar-expand p-0 flex-grow-1">
          <div className="navbar-nav align-items-center justify-content-between w-100">
            <a className="nav-link" href="profile.html">
              <div className="d-flex flex-column align-items-center">
                <div className="icon"><i className="bi bi-person"></i></div>
                <div className="name">Deposit</div>
              </div>
            </a>
            <a className="nav-link" href="contact-us.html">
              <div className="d-flex flex-column align-items-center">
                <div className="icon"><i className="bi bi-question-circle"></i></div>
                <div className="name">Withdrawl</div>
              </div>
            </a>
            <a className="nav-link" href="contact-us.html">
              <div className="d-flex flex-column align-items-center">
                <div className="icon"><i className="bi bi-question-circle"></i></div>
                <div className="name">Settings</div>
              </div>
            </a>
            <a className="nav-link" href="category-list.html">
              <div className="d-flex flex-column align-items-center">
                <div className="icon"><i className="bi bi-arrow-down-left-square"></i></div>
                <div className="name">Recieve</div>
              </div>
            </a>
            <a className="nav-link" href="home.html">
              <div className="d-flex flex-column align-items-center">
                <div className="icon"><i className="bi bi-arrow-up-right-square"></i></div>
                <div className="name">Send</div>
              </div>
            </a>

          </div>
        </nav>
       </footer> */}
    </>
  );
}

export default App;
