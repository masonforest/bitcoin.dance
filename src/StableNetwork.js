import { sample } from "lodash";
import * as borsh from "borsh";
import { bech32, bech32m } from "@scure/base";
import { BorshSchema, borshSerialize, borshDeserialize, Unit } from "borsher";
import {utils as packedUtils} from 'micro-packed';
import { sha256 } from "@noble/hashes/sha256";
const { concatBytes } = packedUtils;
const MAGIC_PREFIX = new Uint8Array([79, 96, 186])
function bech32AddressToBytes(address) {
  const decoded = bech32.decode(address);
  const hrp = decoded.prefix;
  const words = decoded.words;
  const witnessVersion = words[0]; // Witness version
  const witnessProgramWords = words.slice(1); // Witness program words

  // console.log(witnessProgramWords.length);
  return bech32.fromWords(witnessProgramWords);
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

const transactionSchema = BorshSchema.Enum({
  Utxo: BorshSchema.Struct({
    transaction_id: BorshSchema.Array(BorshSchema.u8, 32),
    vout: BorshSchema.i32,
    value: BorshSchema.i64,
  }),
  Withdraw: BorshSchema.Struct({
    nonce: BorshSchema.i64,
    to_bitcoin_address: BorshSchema.String,
    value: BorshSchema.i64,
  }),
});
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

  postTransaction(transaction) {
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
