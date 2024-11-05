import React, {useMemo, useEffect, useRef, useState} from 'react';
import * as borsh from 'borsh';
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from 'borsher';
import Deposit from "./Deposit";
import * as secp256k1 from '@noble/secp256k1';
import {useInterval} from 'react-use'
import { sha256 } from '@noble/hashes/sha2';
import StableNetwork from "./StableNetwork";
import { wordlist } from '@scure/bip39/wordlists/english';
import {base64urlnopad} from '@scure/base';
import * as bip39 from '@scure/bip39';
import { HDKey } from "@scure/bip32";
import "./App.css"

let USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatUsd(value) {
  let USD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })

  return USD.format(new Number((value/100n)) + (new Number(value % 100n))/100)
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

const stable = new StableNetwork({development: import.meta.env.DEV})

function App() {
  const [inputValue, setInputValue] = useState('');
  const [paymentLink, setPaymentLink] = useState(null);

  const [usdBalance, setUsdBalance] = useState(0n)
  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const [mnemonic, setMnemonic] = useState(localStorage.mnemonic || '');

  useEffect(() => {
    async function sweepPaymentLink(entropy) {
      const {privateKey, publicKey: temporaryPublicKey} = HDKey.fromMasterSeed(entropy).derive("m/84'/0'/0'")
      const {publicKey} = HDKey.fromMasterSeed(bip39.mnemonicToEntropy(mnemonic, wordlist)).derive("m/84'/0'/0'")
      let value = await stable.getBalance(temporaryPublicKey, 'usd')
      
      const transaction = borshSerialize(transactionSchema, {
        Transfer: {
          nonce: 0,
          token_type: {Usd: {}},
          to: publicKey,
          value,
        } 
      })
    const signature = await secp256k1.signAsync(sha256(transaction), privateKey)
    await stable.postTransaction(secp256k1.etc.concatBytes(transaction, signature.toCompactRawBytes(), new Uint8Array(([signature.recovery]))))
    history.pushState({}, "", window.location.origin + window.location.pathname)
    }

    if (window.location.search) {
      sweepPaymentLink(base64urlnopad.decode(window.location.search.slice(1)))
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
    const {publicKey} = HDKey.fromMasterSeed(bip39.mnemonicToEntropy(mnemonic, wordlist)).derive("m/84'/0'/0'")
    let usdBalance = await stable.getBalance(publicKey, 'usd')
    setUsdBalance(usdBalance)
    

  }, 1000);
  
  async function send(e) {
    e.preventDefault();
    const temporaryMnemonic = bip39.generateMnemonic(wordlist);
    const {publicKey: temporaryPublicKey} = HDKey.fromMasterSeed(bip39.mnemonicToEntropy(temporaryMnemonic, wordlist)).derive("m/84'/0'/0'")

    const temporaryEntropy = bip39.mnemonicToEntropy(temporaryMnemonic, wordlist);
    setPaymentLink(
      `${window.location.href}?${
      base64urlnopad.encode(temporaryEntropy)}`)
    const {privateKey} = HDKey.fromMasterSeed(bip39.mnemonicToEntropy(mnemonic, wordlist)).derive("m/84'/0'/0'")
    const value =  Math.round(parseFloat(inputValue*100));
    const transaction = borshSerialize(transactionSchema, {
      Transfer: {
        nonce: 0,
        token_type: {Usd: {}},
        to: temporaryPublicKey,
        value,
      } 
    })
    const signature = await secp256k1.signAsync(sha256(transaction), privateKey)
    stable.postTransaction(secp256k1.etc.concatBytes(transaction, signature.toCompactRawBytes(), new Uint8Array(([signature.recovery]))))
  }


  return (
    <>
    <div>
      Balance: {formatUsd(usdBalance)}
    <form onSubmit={send}>
       <input  onChange={handleChange} placeholder="Amount in USD!" />
       <input type="submit" value="Generate Link" />
       </form>
    </div>
    {paymentLink}
  <Deposit   />

  <footer class="page-footer fixed-bottom border-top d-flex align-items-center">
        <nav class="navbar navbar-expand p-0 flex-grow-1">
          <div class="navbar-nav align-items-center justify-content-between w-100">
            <a class="nav-link" href="profile.html">
              <div class="d-flex flex-column align-items-center">
                <div class="icon"><i class="bi bi-person"></i></div>
                <div class="name">Deposit</div>
              </div>
            </a>
            <a class="nav-link" href="contact-us.html">
              <div class="d-flex flex-column align-items-center">
                <div class="icon"><i class="bi bi-question-circle"></i></div>
                <div class="name">Withdrawl</div>
              </div>
            </a>
            <a class="nav-link" href="contact-us.html">
              <div class="d-flex flex-column align-items-center">
                <div class="icon"><i class="bi bi-question-circle"></i></div>
                <div class="name">Settings</div>
              </div>
            </a>
            <a class="nav-link" href="category-list.html">
              <div class="d-flex flex-column align-items-center">
                <div class="icon"><i class="bi bi-arrow-down-left-square"></i></div>
                <div class="name">Recieve</div>
              </div>
            </a>
            <a class="nav-link" href="home.html">
              <div class="d-flex flex-column align-items-center">
                <div class="icon"><i class="bi bi-arrow-up-right-square"></i></div>
                <div class="name">Send</div>
              </div>
            </a>

          </div>
        </nav>
       </footer>
  </>
  );
}

export default App;
