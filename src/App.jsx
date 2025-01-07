import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import * as borsh from "borsh";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
import Deposit from "./Deposit";
import Send from "./Send";
import Withdraw from "./Withdraw";
import * as secp256k1 from "@noble/secp256k1";
import { useInterval } from "react-use";
import { QRCodeSVG } from "qrcode.react";
import { sha256 } from "@noble/hashes/sha2";
import {
  default as StableNetwork,
  pubKeyToAddress,
  pubKeyToBytes,
  transactionSchema,
  signedTransactionSchema,
} from "./StableNetwork";
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
import { randomBytes } from "@noble/hashes/utils";
import { hmac } from "@noble/hashes/hmac";
// import Cookies from 'universal-cookie';
import "./App.css";
secp256k1.etc.hmacSha256Sync = (k, ...m) =>
  hmac(sha256, k, secp256k1.etc.concatBytes(...m));
const mnemonic2 =
  "base water near armed law index boil knife female veteran nature multiply";
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

function formatBtc(value) {
  if (!value) {
    return;
  }
  return (
    new Number(value / 10000000n) + new Number(value % 10000000n) / 10000000
  );
}

export const stable = new StableNetwork({ development: import.meta.env.DEV });

function App() {
  const [entropy, setEntropy] = useState();
  const [magicEntropy, setMagicEntropy] = useState();
  const [inputValue, setInputValue] = useState("");
  const [MagicLink, setMagicLink] = useState(null);
  const [magicLinkBalance, setMagicLinkBalance] = useState(0n);

  const [usdBalance, setUsdBalance] = useState(0n);
  const [utxos, setUtxos] = useState([]);
  const handleChange = (event) => {
    setInputValue(event.target.value);
  };
  const sweepMagicLink = useCallback(() => {
    (async () => {
      const { privateKey, publicKey: temporaryPublicKey } =
        HDKey.fromMasterSeed(
          base64urlnopad.decode(window.location.hash.slice(1)),
        ).derive("m/84'/0'/0");
      let toEntropy = localStorage.entropy ? new Uint8Array(Buffer.from(localStorage.entropy, "base64")) : randomBytes(16) 
      const { publicKey } = HDKey.fromMasterSeed(
        toEntropy,
      ).derive("m/84'/0'/0");
      let value = await stable.getBalance(
        pubKeyToBytes(temporaryPublicKey),
        "usd",
      );
      const transaction = {
        nonce: 0,
        transaction: {
          Transfer: {
            currency: { Usd: {} },
            to: {StableAddress:pubKeyToBytes(publicKey)},
            value,
          },
        },
      };
      const serliaizedTransaction = borshSerialize(
        transactionSchema,
        transaction,
      );
      const signature = secp256k1.sign(
        sha256(serliaizedTransaction),
        privateKey,
      );
      let serialized = borshSerialize(signedTransactionSchema, {
        transaction: transaction.transaction,
        nonce: transaction.nonce,
        signature: secp256k1.etc.concatBytes(
          signature.toCompactRawBytes(),
          new Uint8Array([signature.recovery]),
        ),
      });
      await stable.postRawTransaction(serialized);
      window.location = `/#${base64urlnopad.encode(toEntropy)}`;
    })();
  }, []);

  useEffect(() => {
    if (window.location.pathname == "/magic") {
      setMagicEntropy(base64urlnopad.decode(window.location.hash.slice(1)));
      return;
    }
    if (window.location.hash.slice(1)) {
      setEntropy(Buffer.from(window.location.hash.slice(1), "base64"));
    } else {
      if (localStorage.entropy) {
        window.location = `/#${localStorage.entropy}`;
        setEntropy(Buffer.from(localStorage.entropy, "base64"));
      } else {
        const newEntropy = Buffer.from(randomBytes(16)).toString("base64");
        localStorage.entropy = newEntropy;
        window.location = `/#${newEntropy}`;
        setEntropy(Buffer.from(newEntropy, "base64"));
      }
    }
  }, []);
  const { publicKey, privateKey } = useMemo(() => {
    if (!entropy) {
      return {};
    }
    return HDKey.fromMasterSeed(entropy).derive("m/84'/0'/0");
  }, [entropy]);
  useInterval(
    async () => {
      if (!publicKey) {
        return;
      }
      let usdBalance = await stable.getBalance(pubKeyToBytes(publicKey), "usd");
      setUsdBalance(usdBalance);
    },
    1000,
    [publicKey],
  );

  const address = useMemo(
    () => publicKey && pubKeyToAddress(publicKey),
    [publicKey],
  );

  useInterval(
    async () => {
      if (!magicEntropy) {
        return;
      }
      const { publicKey: temporaryPublicKey } =
        HDKey.fromMasterSeed(magicEntropy).derive("m/84'/0'/0");
      setMagicLinkBalance(
        await stable.getBalance(pubKeyToBytes(temporaryPublicKey), "usd"),
      );
    },
    1000,
    [magicEntropy],
  );

  useInterval(
    async () => {
      if (!publicKey) {
        return;
      }
      // console.log(Buffer.from(pubKeyToBytes(publicKey)).toString("hex"));

      let utxos = await stable.getUtxos(pubKeyToBytes(publicKey), "usd");
      setUtxos(utxos);
    },
    1000,
    [publicKey],
  );

  async function send(e) {
    e.preventDefault();
    let temporaryEntropy = randomBytes(16);
    const { publicKey: temporaryPublicKey } =
      HDKey.fromMasterSeed(temporaryEntropy).derive("m/84'/0'/0");

    const value = Math.round(parseFloat(inputValue * 100));
    const transaction = {
      nonce: 0,
      transaction: {
        Transfer: {
          currency: { Usd: {} },
          to: {StableAddress: pubKeyToBytes(temporaryPublicKey)},
          value,
        },
      },
    };
    const serliaizedTransaction = borshSerialize(
      transactionSchema,
      transaction,
    );
    const signature = secp256k1.sign(sha256(serliaizedTransaction), privateKey);
    let serialized = borshSerialize(signedTransactionSchema, {
      transaction: transaction.transaction,
      nonce: transaction.nonce,
      signature: secp256k1.etc.concatBytes(
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    });
    stable.postRawTransaction(serialized);

    // console.log(
    //   `${window.location.protocol}//${window.location.hostname}${window.location.port ? ":" + window.location.port : ""}/magic#${base64urlnopad.encode(temporaryEntropy)}`,
    // );
    setMagicLink(
      `${window.location.protocol}//${window.location.hostname}${window.location.port ? ":" + window.location.port : ""}/magic#${base64urlnopad.encode(temporaryEntropy)}`,
    );
  }
  async function claimUtxo(utxo) {
    const transaction = {
      nonce: 0,
      transaction: {
        ClaimUtxo: {
          transaction_id: utxo.transaction_id,
          currency: { Usd: {} },
          vout: utxo.vout,
        },
      },
    };
    const serliaizedTransaction = borshSerialize(
      transactionSchema,
      transaction,
    );
    const signature = secp256k1.sign(sha256(serliaizedTransaction), privateKey);
    let serialized = borshSerialize(signedTransactionSchema, {
      transaction: transaction.transaction,
      nonce: transaction.nonce,
      signature: secp256k1.etc.concatBytes(
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    });
    stable.postRawTransaction(serialized);
  }

  const [showQrCodeModal, setShowQrCodeModal] = useState(false);

  return (
    <>
      <div className="wrapper">
        <header className="top-header fixed-top border-bottom d-flex align-items-center">
          <nav className="navbar navbar-expand w-100 p-0 gap-3 align-items-center">
            <div
              className="nav-button"
              data-bs-toggle="offcanvas"
              data-bs-target="#offcanvasSidenav"
            >
              <a href="#">
                <i className="bi bi-list"></i>
              </a>
            </div>
            <div className="brand-logo">Stable Network Wallet</div>
            <form className="searchbar">
              <div className="position-absolute top-50 translate-middle-y search-icon start-0">
                <i className="bi bi-search"></i>
              </div>
              <input
                className="form-control px-5"
                type="text"
                placeholder="Search for anything"
              />
              <div className="position-absolute top-50 translate-middle-y end-0 search-close-icon">
                <i className="bi bi-x-lg"></i>
              </div>
            </form>
          </nav>
        </header>
        <div className="page-content">
          <h1></h1>
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
              <Tab.Pane eventKey="magic-link">
                {address}
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
                    value="Create Magic Payment Link"
                  />
                </form>
                {MagicLink && (
                  <>
                    <div className="d-flex flex-row mt-2">
                      <input
                        className="form-control rounded-3"
                        value={MagicLink}
                        readOnly
                      />
                      <CopyToClipboardButton text={MagicLink} />
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
              <Tab.Pane eventKey="send">
                <Send
                  address={address}
                  usdBalance={usdBalance}
                  privateKey={privateKey}
                />
              </Tab.Pane>
            </Tab.Content>
            <footer className="page-footer fixed-bottom border-top d-flex align-items-center">
              <nav className="navbar navbar-expand p-0 flex-grow-1">
                <div className="navbar-nav align-items-center justify-content-between w-100">
                  <Nav.Link eventKey="history">
                    <div className="d-flex flex-column align-items-center">
                      <div className="icon">
                        <i className="bi bi-receipt"></i>
                      </div>
                      <div className="name">History</div>
                    </div>
                  </Nav.Link>
                  <Nav.Link eventKey="magic-link">
                    <div className="d-flex flex-column align-items-center">
                      <div className="icon">
                        <i className="bi bi-magic"></i>
                      </div>
                      <div className="name">Magic Link</div>
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
        </div>
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
              value={MagicLink}
            />
          </Modal.Body>
        </Modal>

        <Modal
          show={magicEntropy}
          fullscreen={"md-down"}
          onHide={() => setShowQrCodeModal(false)}
        >
          <Modal.Header closeButton>
            <Modal.Title>Sending...</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <button
              onClick={() => sweepMagicLink()}
              className="btn btn-success btn-xlg w-100"
            >
              <title>
                Accept {formatUsd(magicLinkBalance)} on the Stable Network
              </title>
              Accept {formatUsd(magicLinkBalance)}
            </button>
          </Modal.Body>
        </Modal>
        <Modal
          show={utxos.length}
          fullscreen={"md-down"}
          onHide={() => setUtxos([])}
        >
          <Modal.Header closeButton>
            <Modal.Title>Claim Bitcoin Payment</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              A payment was made to you in Bitcoin transaction{" "}
              <a
                target="_blank"
                href={`https://mempool.space/tx/${utxos[0] && Buffer.from(utxos[0].transaction_id).toString("hex")}?mode=details`}
              >
                {utxos[0] &&
                  Buffer.from(utxos[0].transaction_id)
                    .toString("hex")
                    .substr(0, 6) +
                    ".." +
                    Buffer.from(utxos[0].transaction_id)
                      .toString("hex")
                      .substr(-6)}
              </a>
            </p>
            <button
              onClick={() => claimUtxo(utxos[0])}
              className="btn btn-success btn-xlg w-100"
            >
              <title>
                Accept {formatBtc(utxos[0] && utxos[0].value)} on the Stable
                Network
              </title>
              Accept {formatBtc(utxos[0] && utxos[0].value)} BTC
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
      </div>
    </>
  );
}

export default App;
