import {sample} from "lodash"
import * as borsh from 'borsh';

export default class StableNetwork {
  constructor({peers, development = false}) {
    if(development) {
      this.development = development
      this.peers = peers || ["127.0.0.1"]
    } else {
      // TODO move this data to an OP_RETURN data 
      // at a certain block height
      this.peers = ["mainnet.bitcoin.dance"]
    }
  }

  get depositAddress() {
    this.get("/deposit_address")
  }

  async getBalance(address, currency) {
    return borsh.deserialize('i64',
     await this.get(`/balances/${currency}/${Buffer.from(address).toString("hex")}`)
    )
  }

  async get(path) {
    return  new Uint8Array(await (await fetch(
      `${this.protocol}://${sample(this.peers)}${path}`
    )).arrayBuffer())
  }

  postTransaction(transaction) {
    return this.post('/transactions', transaction)
  }

  post(path, body) {
    return fetch(
      `${this.protocol}://${sample(this.peers)}${path}`, {
        method: "POST",
        body
      }
    )
  }

  get protocol() {
    return this.development ? "http" : "https"
  }
}
