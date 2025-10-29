# FlightStakeFi - Contracts

This directory contains the Solidity smart contracts for the FlightStakeFi protocol.

## Current Progress: Phase 1 - Core Smart Contracts

We are currently in Phase 1, focusing on building the essential on-chain logic.

### 1.1 `TicketNFT.sol` (✅ Completed & Deployed)

* **Status:** The core `TicketNFT.sol` contract has been successfully coded, deployed, and interacted with on the Sepolia testnet.
* **Address (Sepolia):** `0x1906909DbdEe75e45fB0daA74577860354Dba3e0`
    * [View on Etherscan](https://sepolia.etherscan.io/address/0x1906909DbdEe75e45fB0daA74577860354Dba3e0)
* **Key Features Implemented:**
    * ERC721 standard compliance.
    * `ERC721URIStorage` for unique metadata URLs per token.
    * Custom `State` enum (`IDLE`, `STAKED`, `COLLATERALIZED`, `LISTED`).
    * Storage for `FlightDetails` (route hash, timestamp, fare tier).
    * Controlled `mint` function restricted to the deployer (`_minterAddress`).
    * Public getter functions (`getFlightDetails`, `getTokenState`) to read data.
    * **Core Security:** Overridden `_update` function enforces that tokens can **only** be transferred if their state is `IDLE`.
    * Internal `_setTokenState` function for secure state changes (callable only by this contract).
* **Interaction:** Successfully minted Token ID #1 on Sepolia via the `mintTicket.js` script.

---

## Next Steps (Remaining Phase 1 Contracts)

The `TicketNFT.sol` contract is functionally complete for now. We will add the external "Protocol Door" functions (`stake`, `unstake`, etc.) **on-demand** as we build the contracts that need to call them.

The immediate next steps are to design and implement the remaining core contracts as outlined in the roadmap:

1.  **`PricingOracle.sol`:** To fetch and store the value of each TicketNFT.
2.  **`StakingVault.sol`:** To handle staking and reward distribution.
3.  **`LendingPool.sol`:** To manage collateralization and borrowing.
4.  **`Marketplace.sol`:** For listing and trading TicketNFTs.
5.  **`LiquidationEngine.sol`:** To handle undercollateralized loans.

We will start with `PricingOracle.sol` next.