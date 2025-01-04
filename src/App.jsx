import React, { useMemo, useEffect, useRef, useState } from "react";
import * as borsh from "borsh";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";
import * as secp256k1 from "@noble/secp256k1";
import { useInterval } from "react-use";
import { QRCodeSVG } from "qrcode.react";
import { sha256 } from "@noble/hashes/sha2";
import {
  default as StableNetwork,
  pubKeyToAddress,
  pubKeyToBytes,
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
// import Cookies from 'universal-cookie';
import "./App.css";
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

const pairSchema = BorshSchema.Struct({
  first: BorshSchema.i32,
  second: BorshSchema.f32,
});
const transactionSchema = BorshSchema.Struct({
  nonce: BorshSchema.i64,
  transaction: BorshSchema.Enum({
    Transfer: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Snt: BorshSchema.Unit,
        Usd: BorshSchema.Unit,
      }),
      to: BorshSchema.Array(BorshSchema.u8, 33),
      value: BorshSchema.i64,
    }),
    ClaimUtxo: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Snt: BorshSchema.Unit,
        Usd: BorshSchema.Unit,
      }),
      transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
      vout: BorshSchema.i32,
    }),
    Withdraw: BorshSchema.Struct({
      to_bitcoin_address: BorshSchema.String,
      currency: BorshSchema.Enum({
        Snt: BorshSchema.Unit,
        Usd: BorshSchema.Unit,
      }),
      value: BorshSchema.i64,
    }),
  }),
});
const signedTransactionSchema = BorshSchema.Struct({
  transaction: BorshSchema.Enum({
    Transfer: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Snt: BorshSchema.Unit,
        Usd: BorshSchema.Unit,
      }),
      to: BorshSchema.Array(BorshSchema.u8, 33),
      value: BorshSchema.i64,
    }),
    ClaimUtxo: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Snt: BorshSchema.Unit,
        Usd: BorshSchema.Unit,
      }),
      transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
      vout: BorshSchema.i32,
    }),
    Withdraw: BorshSchema.Struct({
      to_bitcoin_address: BorshSchema.String,
      currency: BorshSchema.Enum({
        Snt: BorshSchema.Unit,
        Usd: BorshSchema.Unit,
      }),
      value: BorshSchema.i64,
    }),
  }),
  nonce: BorshSchema.i64,
  signature: BorshSchema.Array(BorshSchema.u8, 65),
});

function entropy() {
  return window.location.search.slice(1);
}

// function magicLinkEntropy() {
//   if(window.location.path == "magic") {
//     return window.location.search.slice(1)
//   }
// }

const stable = new StableNetwork({ development: import.meta.env.DEV });

function App() {
  const [entropy, setEntropy] = useState();
  // const [address, setAddress] = useState();
  const [inputValue, setInputValue] = useState("");
  const [paymentLink, setPaymentLink] = useState(null);
  const [paymentLinkBalance, setPaymentLinkBalance] = useState(0n);

  const [usdBalance, setUsdBalance] = useState(0n);
  const [utxos, setUtxos] = useState([]);
  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const [mnemonic, setMnemonic] = useState();

  useEffect(() => {
    if (window.location.hash.slice(1)) {
      setEntropy(Buffer.from(window.location.hash.slice(1), "base64"));
    } else {
      if (localStorage.entropy) {
        window.location = `/#${localStorage.entropy}`;
        setEntropy(Buffer.from(localStorage.entropy, "base64"));
      } else {
        const newEnropy = Buffer.from(randomBytes(16)).toString("base64");
        localStorage.entropy = newEnropy;
        window.location = `/#${newEntropy}`;
        setEntropy(Buffer.from(newEntropy, "base64"));
      }
    }
  }, []);
  const {publicKey, privateKey} = useMemo(() => {

    if (!entropy) {return {}}
    console.log(entropy.toString("base64"))
    return HDKey.fromMasterSeed(
      entropy
    ).derive("m/84'/0'/0")
  }, [entropy])
  useInterval(async () => {
    if (!publicKey) {return}
    // const { publicKey } = HDKey.fromMasterSeed(
    //   entropy
    //   // bip39.mnemonicToEntropy(mnemonic, wordlist),
    // ).derive("m/84'/0'/0");
    // // console.log(Buffer.from(publicKey).toString("hex"));
    console.log(Buffer.from(pubKeyToBytes(publicKey)).toString("hex"))
    let usdBalance = await stable.getBalance(pubKeyToBytes(publicKey), "usd");
    console.log(usdBalance);
    setUsdBalance(usdBalance);
  }, 1000, [publicKey]);

  const address = useMemo(() => (
    publicKey && pubKeyToAddress(publicKey)
  ), [publicKey])
  // const sweepPaymentLink = async () => {
  //   const { privateKey, publicKey: temporaryPublicKey } = HDKey.fromMasterSeed(
  //     base64urlnopad.decode(entropy),
  //   ).derive("m/84'/0'/0");
  //   const { publicKey } = HDKey.fromMasterSeed(
  //     bip39.mnemonicToEntropy(mnemonic, wordlist),
  //   ).derive("m/84'/0'/0");
  //   let value = await stable.getBalance(temporaryPublicKey, "usd");

  //   const transaction = borshSerialize(transactionSchema, {
  //     Transfer: {
  //       nonce: 0,
  //       currency: { Usd: {} },
  //       to: publicKey,
  //       value,
  //     },
  //   });
  //   const signature = await secp256k1.signAsync(
  //     sha256(transaction),
  //     privateKey,
  //   );
  //   await stable.postTransaction(
  //     secp256k1.etc.concatBytes(
  //       transaction,
  //       signature.toCompactRawBytes(),
  //       new Uint8Array([signature.recovery]),
  //     ),
  //   );
  //   history.pushState(
  //     {},
  //     "",
  //     window.location.origin + window.location.pathname,
  //   );
  //   setEntropy(null);
  // };

  //   if (window.location.search) {
  //     sweepPaymentLink(base64urlnopad.decode(window.location.search.slice(1)));
  //   }
  // }, []);
  // useEffect(() => {
  //   if (!mnemonic) {
  //     const newMnemonic =
  //       localStorage.mnemonic ||
  //       getCookie("mnemonic") ||
  //       bip39.generateMnemonic(wordlist);
  //     localStorage.mnemonic = newMnemonic;
  //     // setCookie("mnemonic", newMnemonic, 400)
  //     setMnemonic(newMnemonic);
  //   }
  // }, [mnemonic]);

  // useEffect(() => {
  //   if (!mnemonic) {
  //     return;
  //   }

  //   // window.location = "/#" + Buffer.from(bip39.mnemonicToEntropy(mnemonic, wordlist)).toString("base64");

  //   const { publicKey, privateKey } = HDKey.fromMasterSeed(
  //     bip39.mnemonicToEntropy(mnemonic, wordlist),
  //   ).derive("m/84'/0'/0");
  //   // console.log("pkey:" + Buffer.from(privateKey).toString("hex"));
  //   setAddress(pubKeyToAddress(publicKey));
  // }, [entropy]);

  // useInterval(async () => {

  //   const { publicKey: temporaryPublicKey } = HDKey.fromMasterSeed(
  //     base64urlnopad.decode(entropy),
  //   ).derive("m/84'/0'/0");
  //   setPaymentLinkBalance(await stable.getBalance(temporaryPublicKey, "usd"));
  // }, 1000);

  useInterval(async () => {
    if (!publicKey) {return}
    // const { publicKey, privateKey } = HDKey.fromMasterSeed(
    //   bip39.mnemonicToEntropy(mnemonic, wordlist),
    // ).derive("m/84'/0'/0");
    // console.log(
    //   "utxo bytes:" + Buffer.from(pubKeyToBytes(publicKey)).toString("hex"),
    // );
    
    let utxos = await stable.getUtxos(pubKeyToBytes(publicKey), "usd");
    setUtxos(utxos);
  }, 1000, [publicKey]);

  async function send(e) {
    e.preventDefault();
    const temporaryMnemonic = bip39.generateMnemonic(wordlist);
    const { publicKey: temporaryPublicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(temporaryMnemonic, wordlist),
    ).derive("m/84'/0'/0");

    const temporaryEntropy = bip39.mnemonicToEntropy(
      temporaryMnemonic,
      wordlist,
    );
    const { privateKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0");
    const value = Math.round(parseFloat(inputValue * 100));
    const transaction = borshSerialize(transactionSchema, {
      nonce: 3,
      transaction: {
        Transfer: {
          currency: { Usd: {} },
          to: temporaryPublicKey,
          value,
        },
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
  async function claimUtxo(utxo) {
    const { publicKey, privateKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0");
    const transaction = borshSerialize(transactionSchema, {
      nonce: 0,
      transaction: {
        ClaimUtxo: {
          transaction_id: utxo.transaction_id,
          currency: { Usd: {} },
          vout: utxo.vout,
        },
      },
    });
    console.log(Buffer.from(transaction).toString("hex"));
    // console.log(Buffer.from(transaction).toString(""))
    //   first: 3,
    //   second: .5,
    // })).toString("hex"))
    const signature = await secp256k1.signAsync(
      sha256(transaction),
      privateKey,
    );
    console.log(signature.r);
    console.log(signature.s);
    console.log(signature.recovery);
    console.log(signature.toCompactRawBytes());
    console.log(Buffer.from(pubKeyToBytes(publicKey)).toString("hex"));
    console.log(
      signature.recoverPublicKey(sha256(sha256(transaction))).toHex(),
    );
    let serialized = borshSerialize(signedTransactionSchema, {
      transaction: {
        ClaimUtxo: {
          currency: { Usd: {} },
          transaction_id: utxo.transaction_id,
          vout: utxo.vout,
        },
      },
      nonce: 0,
      signature: secp256k1.etc.concatBytes(
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    });
    console.log(
      Buffer.from(
        secp256k1.etc.concatBytes(
          signature.toCompactRawBytes(),
          new Uint8Array([signature.recovery]),
        ),
      ).toString("hex"),
    );
    console.log(serialized.length);
    stable.postTransaction(serialized);
  }

  const [showQrCodeModal, setShowQrCodeModal] = useState(false);

  return (
    <>
      <div class="wrapper">
        <header class="top-header fixed-top border-bottom d-flex align-items-center">
          <nav class="navbar navbar-expand w-100 p-0 gap-3 align-items-center">
            <div
              class="nav-button"
              data-bs-toggle="offcanvas"
              data-bs-target="#offcanvasSidenav"
            >
              <a href="javascript:;">
                <i class="bi bi-list"></i>
              </a>
            </div>
            <div class="brand-logo">Stable Network Wallet</div>
            <form class="searchbar">
              <div class="position-absolute top-50 translate-middle-y search-icon start-0">
                <i class="bi bi-search"></i>
              </div>
              <input
                class="form-control px-5"
                type="text"
                placeholder="Search for anything"
              />
              <div class="position-absolute top-50 translate-middle-y end-0 search-close-icon">
                <i class="bi bi-x-lg"></i>
              </div>
            </form>
          </nav>
        </header>
        <div class="page-content">
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
              <Tab.Pane eventKey="send">
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
              value={paymentLink}
            />
          </Modal.Body>
        </Modal>

        <Modal
          show={showQrCodeModal}
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
            A payment was made to you in Bitcoin transaction <a target="_blank" href={`https://mempool.space/tx/${utxos[0] && (Buffer.from(utxos[0].transaction_id).toString("hex"))}?mode=details`}>{utxos[0] && Buffer.from(utxos[0].transaction_id).toString("hex").substr(0, 6) + ".." + Buffer.from(utxos[0].transaction_id).toString("hex").substr(-6)}</a>
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
