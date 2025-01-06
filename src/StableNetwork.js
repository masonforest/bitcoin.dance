import { sample } from "lodash";
import * as borsh from "borsh";
import * as secp256k1 from "@noble/secp256k1";
import { bech32, bech32m } from "@scure/base";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
import {utils as packedUtils} from 'micro-packed';
import { sha256 } from "@noble/hashes/sha256";
const { concatBytes } = packedUtils;
const MAGIC_PREFIX = new Uint8Array([79, 96, 186])
export const transactionSchema = BorshSchema.Struct({
  nonce: BorshSchema.i64,
  transaction: BorshSchema.Enum({
    Transfer: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Usd: BorshSchema.Unit,
      }),
      to: BorshSchema.Enum({
       BitcoinAddress:BorshSchema.String, 
       StableAddress: BorshSchema.Array(BorshSchema.u8, 17),
      }),
      value: BorshSchema.i64,
    }),
    ClaimUtxo: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Usd: BorshSchema.Unit,
      }),
      transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
      vout: BorshSchema.i32,
    }),
  }),
});
export const signedTransactionSchema = BorshSchema.Struct({
  transaction: BorshSchema.Enum({
    Transfer: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Usd: BorshSchema.Unit,
      }),
      to: BorshSchema.Enum({
       BitcoinAddress:BorshSchema.String, 
       StableAddress: BorshSchema.Array(BorshSchema.u8, 17),
      }),
      value: BorshSchema.i64,
    }),
    ClaimUtxo: BorshSchema.Struct({
      currency: BorshSchema.Enum({
        Usd: BorshSchema.Unit,
      }),
      transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
      vout: BorshSchema.i32,
    }),
  }),
  nonce: BorshSchema.i64,
  signature: BorshSchema.Array(BorshSchema.u8, 65),
});
function bech32AddressToBytes(address) {
  const decoded = bech32.decode(address);
  const hrp = decoded.prefix;
  const words = decoded.words;
  const witnessVersion = words[0]; // Witness version
  const witnessProgramWords = words.slice(1); // Witness program words

  // console.log(witnessProgramWords.length);
  return bech32.fromWords(witnessProgramWords);
}

export function addressToObject(address) {
  if (address.startsWith("bc1qfast")) {
    return {StableAddress: bech32AddressToBytes(address).slice(-17)}
  } else {
    return {BitcoinAddress: address}
  }
} 

export function pubKeyToBytes(publicKey) {
  // console.log("pubkey:"+ Buffer.from(publicKey).toString("hex"))
  const publicKeyHash = sha256(publicKey)
  // console.log("pubhash:"+ Buffer.from(publicKeyHash).toString("hex"))
  return publicKeyHash.slice(-17)
} 

export function pubKeyToAddress(publicKey, witnessVersion = 0) {
  // console.log("bytes:"+ Buffer.from(pubKeyToBytes(publicKey)).toString("hex"))
  // console.log("publicKey:"+Buffer.from(publicKey).toString("hex"))
  const publicKeyHash = sha256(publicKey)
  // console.log("pkeyhash: "+ Buffer.from(publicKeyHash).toString("hex")) 
  const address = concatBytes(MAGIC_PREFIX, publicKeyHash.slice(-17))
  // console.log("full:"+Buffer.from(publicKeyHash).toString("hex"))
  // console.log("before:"+Buffer.from(address).toString("hex"))
  const witnessProgramWords = bech32.toWords(address);
  const words = [witnessVersion, ...witnessProgramWords];
  // console.log("after:"+Buffer.from(bech32AddressToBytes(bech32.encode("bc", words))).toString("hex"));
  return bech32.encode("bc", words);
} 

// const transactionSchema = BorshSchema.Enum({
//   Utxo: BorshSchema.Struct({
//     transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
//     vout: BorshSchema.i32,
//     value: BorshSchema.i64,
//   }),
//   Withdraw: BorshSchema.Struct({
//     nonce: BorshSchema.i64,
//     to_bitcoin_address: BorshSchema.String,
//     value: BorshSchema.i64,
//   }),
// });
export default class StableNetwork {
  constructor({ peers, development = false}) {
    if (development) {
      this.development = development;
      this.peers = peers || ["127.0.0.1"];
    } else {
      // TODO move this data to an OP_RETURN data
      // at a certain block height
      this.peers = ["mainnet.bitcoin.dance"];
    }
  }
  
  get depositAddress() {
    this.get("/deposit_address");
  }

  async getUtxos(address) {
    // console.log(Buffer.from(address).length)
    return borshDeserialize(BorshSchema.Vec((
      BorshSchema.Struct({
        transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
        vout: BorshSchema.i32,
        value: BorshSchema.i64,
      }))),
      await this.get(
        `/utxos/${Buffer.from(address).toString("hex")}`,
      ),
    );
  }

  async getBalance(address, currency) {
    return borsh.deserialize(
      "i64",
      await this.get(
        `/balances/${currency}/${Buffer.from(address).toString("hex")}`,
      ),
    );
  }

  async get(path) {
    return new Uint8Array(
      await (
        await fetch(`${this.protocol}://${sample(this.peers)}${path}`)
      ).arrayBuffer(),
    );
  }

  async postTransaction(transaction, privateKey) {
    const transactionAndNonce = {
      nonce: 2,
      transaction
    };
    const serliaizedTransaction = borshSerialize(
      transactionSchema,
      transactionAndNonce,
    );
    // console.log(Buffer.from(serliaizedTransaction).toString("hex"))
    const signature = secp256k1.sign(
      sha256(serliaizedTransaction),
      privateKey,
    );
    let serialized = borshSerialize(signedTransactionSchema, {
      transaction: transactionAndNonce.transaction,
      nonce: transactionAndNonce.nonce,
      signature: secp256k1.etc.concatBytes(
        signature.toCompactRawBytes(),
        new Uint8Array([signature.recovery]),
      ),
    });
    let response = await this.postRawTransaction(serialized);
    
    // console.log(Buffer.from(response).toString("hex"))
    const responseSchema = { array: { type: 'u8', len: 32 }}
    return borsh.deserialize(responseSchema, response)
  }

  postRawTransaction(transaction) {
    return this.post("/transactions", transaction);
  }

  async post(path, body) {
    return new Uint8Array(
      await (
        await fetch(`${this.protocol}://${sample(this.peers)}${path}`, {
          method: "POST",
          body,
        })
      ).arrayBuffer(),
    );
  }

  get protocol() {
    return this.development ? "http" : "https";
  }
}
