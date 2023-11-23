# DSCP Lang Flows

DSCP is a _domain-specific-language_ ( DSL ) for designing **[token process flows](https://github.com/digicatapult/dscp-documentation/blob/main/docs/tokenModels/language.md)**. This new way of doing flows has a compiler for automatically generating process **[guard rails](https://github.com/digicatapult/dscp-documentation/blob/main/docs/tokenModels/guardRails.md)** using the previously mentioned purpose built compiler.

The **`dscp-lang`**, tool we use for parsing token flows, can be found in the **[dscp-node](https://github.com/digicatapult/dscp-node)** repository.

To differentiate documents with code that has a high-level of abstraction from other things, let's consider using the custom file extension **`*.dscp`**.

To compile the final _token flow json_ using the _token dscp code_ as an input the **[dscp-lang](https://github.com/digicatapult/dscp-node/tree/main/tools/lang)** needs to be used, therefore a command like the following:

```sh
dscp-lang -- build -v ./hyproof-token-flows.dscp -o hyproof-token-flows.json
```

To create, as in, deploy the new token flows ( described in the json ) into the node's _processValidation_ set, something like the following can be used ( make sure the chain is running first ):

```sh
process-management create -h localhost -p 9944 -u //Alice -f hyproof-token-flows.json # OR 127.0.0.1
```

---

# DSCP Lang Flows: Description

Available files:

* The high-level version of the process flow written using the DSCP Lang can be found here:
  - **[hyproof-token-flows.dscp](./hyproof-token-flows.dscp)**

* The outputted json array here containing all the rules can be found here:
  - **[hyproof-token-flows.json](./hyproof-token-flows.json)**

For testing, one can use the **[PolkadotJsApp GUI](https://polkadot.js.org/apps/)** or use a NodeJs terminal to interact with the chain directly.

---
