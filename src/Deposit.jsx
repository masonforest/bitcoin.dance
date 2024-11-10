import React, { useMemo, useEffect, useRef } from "react";
// import  bitcoin  from 'bitcoinjs-lib';
import "./App.css";
import { bech32 } from "@scure/base";
import * as secp256k1 from "@noble/secp256k1";
import { HDKey } from "@scure/bip32";
import { Container, Tabs, Tab, Row, Col } from "react-bootstrap";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import * as btc from "@scure/btc-signer";
import { sha256 } from "@noble/hashes/sha256";
import StableNetwork from "./StableNetwork";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils";

const STABLE_MULTI_SIG_ADDRESS =
  "bc1ql7kce0pzf64g9ugnx29ds9a38f9gttv43sja66w88lveh237eqts50k0am";
const STABLE_NODES = import.meta.env.PROD ? ["178.156.148.155"] : ["127.0.0.1"];
async function sweepWallet(privateKey, depositAddress) {
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const { address, redeemScript, witnessScript, script } = btc.p2wpkh(
    secp256k1.getPublicKey(privateKey, true),
  );
  const transaction = new btc.Transaction();
  let inputs = (
    await (
      await fetch(`https://mempool.space/api/address/${depositAddress}/utxo`)
    ).json()
  ).filter(({ value }) => value > 546);
  for (const input of inputs) {
    transaction.addInput({
      txid: input.txid,
      index: input.vout,
      witnessUtxo: {
        amount: BigInt(input.value),
        script,
      },
    });
  }

  transaction.addOutputAddress(
    STABLE_MULTI_SIG_ADDRESS,
    BigInt(input.value) - 1000n,
  );
  transaction.sign(privateKey);
  transaction.finalize();
}
function App() {
  const stable = new StableNetwork({ development: import.meta.env.DEV });
  const mnemonic = useMemo(() => {
    if (!localStorage.mnemonic) {
      localStorage.mnemonic = bip39.generateMnemonic(wordlist);
    }

    return localStorage.mnemonic;
  }, []);
  const depositAddress = useMemo(() => {
    const { publicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    return btc.p2wpkh(publicKey).address;
  }, [mnemonic]);

  const pollingRef = useRef(null);
  const transaction = new btc.Transaction();
  useEffect(() => {
    const startPolling = () => {
      pollingRef.current = setInterval(async () => {
        let inputs = (
          await (
            await fetch(
              `https://mempool.space/api/address/${depositAddress}/utxo`,
            )
          ).json()
        ).filter(({ value }) => value > 546);
        if (inputs.length) {
          const { privateKey } = HDKey.fromMasterSeed(
            bip39.mnemonicToEntropy(mnemonic, wordlist),
          ).derive("m/84'/0'/0'");
          sweepWallet(privateKey, depositAddress);
        }
      }, 30000); // Poll every 30 seconds
    };
    startPolling();

    return () => {
      clearInterval(pollingRef.current);
    };
  }, [depositAddress]);

  let fromPubKey =
    "02fc0a1673787b9144ae4837d55acbe455dde3d8885e58aef07e281e7655ce9747";

  return (
    <Container
      style={{ maxWidth: "600px", marginTop: "50px" }}
      className="justify-content-md-center"
    >
      <Row className="justify-content-md-center">
        <Col>
          <div>
            {/* Deposit content goes here */}
            <p>Send Bitcoin to The Deposit Address to Convert to USD</p>
            <a rel="payment" href={`bitcoin:${depositAddress}`}>
              {depositAddress}
            </a>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default App;
