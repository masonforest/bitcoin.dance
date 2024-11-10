import React, { useMemo, useEffect, useRef, useState } from "react";
// import  bitcoin  from 'bitcoinjs-lib';
import "./App.css";
import { bech32 } from "@scure/base";
import * as borsh from "borsh";
import { useInterval } from "react-use";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
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
function formatUsd(value) {
  let USD = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  return USD.format(new Number(value / 100n) + new Number(value % 100n) / 100);
}
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
  Withdraw: BorshSchema.Struct({
    nonce: BorshSchema.i64,
    to_bitcoin_address: BorshSchema.String,
    value: BorshSchema.i64,
  }),
});

function Withdraw() {
  const stable = new StableNetwork({ development: import.meta.env.DEV });
  const [inputValue, setInputValue] = useState("");
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [transactionLink, setTransactionLink] = useState("");
  const [usdBalance, setUsdBalance] = useState(0n);
  const mnemonic = useMemo(() => {
    if (!localStorage.mnemonic) {
      localStorage.mnemonic = bip39.generateMnemonic(wordlist);
    }

    return localStorage.mnemonic;
  }, []);
  useInterval(async () => {
    const { publicKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    console.log(Buffer.from(publicKey).toString("hex"));
    let usdBalance = await stable.getBalance(publicKey, "usd");
    setUsdBalance(usdBalance);
  }, 1000);
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
  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  async function withdraw(e) {
    e.preventDefault();
    const { privateKey } = HDKey.fromMasterSeed(
      bip39.mnemonicToEntropy(mnemonic, wordlist),
    ).derive("m/84'/0'/0'");
    const value = Math.round(parseFloat(inputValue * 100));
    const transaction = borshSerialize(transactionSchema, {
      Withdraw: {
        nonce: 0,
        to_bitcoin_address: bitcoinAddress,
        value,
      },
    });
    const signature = await secp256k1.signAsync(
      sha256(transaction),
      privateKey,
    );
    let response = await stable.postTransaction(
      secp256k1.etc.concatBytes(
        transaction,
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    );
    const transactionId = Buffer.from(
      borsh.deserialize({ array: { type: "u8", len: 32 } }, response),
    ).toString("hex");

    setBitcoinAddress("");
    setInputValue("");
    setTransactionLink(`https://mempool.space/tx/${transactionId}`);
  }
  console.log(usdBalance);
  return (
    <div>
      <h4 className="my-2 text-center fw-bold section-title">
        Balance: {formatUsd(usdBalance)}
      </h4>
      <form onSubmit={withdraw}>
        <div className="form-floating mb-2">
          <input
            onChange={(e) => setBitcoinAddress(e.target.value)}
            value={bitcoinAddress}
            type="text"
            className="form-control rounded-3"
            id="floatingInputName"
            placeholder="Bitcoin Address"
          />
          <label htmlFor="floatingInputName">Bitcoin Address</label>
        </div>
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
          value="Withdraw"
        />
      </form>
      {transactionLink && (
        <a href={transactionLink}>View Withdraw Transaction</a>
      )}
    </div>
  );
}

export default Withdraw;
