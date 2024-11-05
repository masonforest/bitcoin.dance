import React, { useMemo, useEffect, useRef, useState } from "react";
import * as borsh from "borsh";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
import Deposit from "./Deposit";
import * as secp256k1 from "@noble/secp256k1";
import { useInterval } from "react-use";
import { sha256 } from "@noble/hashes/sha2";
import StableNetwork from "./StableNetwork";
import { wordlist } from "@scure/bip39/wordlists/english";
import { base64urlnopad } from "@scure/base";
import CopyToClipboardButton from './CopyToClipBoardButton';
import * as bip39 from "@scure/bip39";
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
  const [inputValue, setInputValue] = useState("");
  const [paymentLink, setPaymentLink] = useState(null);

  const [usdBalance, setUsdBalance] = useState(0n);
  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const [mnemonic, setMnemonic] = useState(localStorage.mnemonic || "");

  useEffect(() => {
    async function sweepPaymentLink(entropy) {
      const { privateKey, publicKey: temporaryPublicKey } =
        HDKey.fromMasterSeed(entropy).derive("m/84'/0'/0'");
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
    }

    if (window.location.search) {
      sweepPaymentLink(base64urlnopad.decode(window.location.search.slice(1)));
    }
  }, []);
  useEffect(() => {
    if (!mnemonic) {
      const newMnemonic = bip39.generateMnemonic(wordlist);
      localStorage.mnemonic = newMnemonic;
      setMnemonic(newMnemonic);
    }
  }, [mnemonic]);

  useInterval(async () => {
    const { publicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    console.log(Buffer.from(publicKey).toString("hex"))
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
    setPaymentLink(
      `${window.location.href}?${base64urlnopad.encode(temporaryEntropy)}`,
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
  }

  return (
    <>

      <Tab.Container id="left-tabs-example" defaultActiveKey="send">
        <Tab.Content>
          <Tab.Pane eventKey="deposit">
            {" "}
            <Deposit />
          </Tab.Pane>
          <Tab.Pane eventKey="send">
          <h4 class="my-2 text-center fw-bold section-title"> Balance: {formatUsd(usdBalance)}</h4>
            <form onSubmit={send}>
              <div class="form-floating">
                <input
                  onChange={handleChange}
                  type="text"
                  class="form-control rounded-3"
                  id="floatingInputName"
                  placeholder="Name"
                />
                <label for="floatingInputName">Amount</label>
              </div>
              <input
                class="btn btn-success w-100 mt-4"
                type="submit"
                value="Create Payment"
              />
            </form>
            {paymentLink&& <div class="mt-2"> <b>Copy And Send Link: <input class="form-control rounded-3" value={paymentLink} /></b></div>}
          </Tab.Pane>
        </Tab.Content>
        <footer className="page-footer fixed-bottom border-top d-flex align-items-center">
          <nav className="navbar navbar-expand p-0 flex-grow-1">
            <div className="navbar-nav align-items-center justify-content-between w-100">
              <Nav.Link eventKey="deposit">
                <div className="d-flex flex-column align-items-center">
                  <div className="icon">
                    <i className="bi bi-person"></i>
                  </div>
                  <div className="name">Deposit</div>
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
