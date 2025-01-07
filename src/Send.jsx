import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { stable } from "./App";
import { addressToObject } from "./StableNetwork";

function formatUsd(value) {
  let USD = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  return USD.format(new Number(value / 100n) + new Number(value % 100n) / 100);
}

function Send({ address, usdBalance, privateKey }) {
  const [value, setValue] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [transactionId, setTransactionId] = useState();
  const send = useCallback((event) => {
    event.preventDefault();
    (async () => {
      //   console.log(addressToObject(recipientAddress));
      let newTransactionId = await stable.postTransaction(
        {
          Transfer: {
            currency: { Usd: {} },
            to: addressToObject(recipientAddress),
            value: Math.round(parseFloat(value * 100)),
          },
        },
        privateKey,
      );

      if (!recipientAddress.startsWith("bc1qfast")) {
        setTransactionId(newTransactionId);
      }
      setRecipientAddress("");
      setValue("");
    })();
  });
  return (
    <>
      {address}
      <h4 className="my-2 text-center fw-bold section-title">
        {" "}
        Balance: {formatUsd(usdBalance)}
      </h4>
      <form onSubmit={send}>
        <div className="form-floating">
          <input
            onChange={(event) => setRecipientAddress(event.target.value)}
            value={recipientAddress}
            type="text"
            className="form-control rounded-3"
            id="floatingInputName"
            placeholder="Address"
          />
          <label htmlFor="floatingInputName">Address</label>
        </div>
        <div className="form-floating mt-2">
          <input
            onChange={(event) => setValue(event.target.value)}
            value={value}
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
          value="Send"
        />
      </form>
      {transactionId && (
        <a
          target="_blank"
          href={
            transactionId &&
            Buffer.from(
              `https://mempool.space/tx/${Buffer.from(transactionId).toString("hex")}`,
            )
          }
        >
          View Withdraw in Block Explorer{" "}
          <i class="bi bi-box-arrow-in-up-right"></i>
        </a>
      )}
    </>
  );
}

export default Send;
