// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract PricingOracle {

    // --- State Variables ---
    mapping(uint256 => uint256) private _prices;
    address private _adminAddress;

    // --- Event ---
    /**
     * @dev Emitted when the price for a token is updated.
     */
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);

    // --- Constructor ---
    constructor() {
        _adminAddress = msg.sender;
    }

    // --- Functions ---

    /**
     * @notice Gets the stored price for a given token ID.
     */
    function getPrice(uint256 tokenId)
        public
        view
        returns (uint256)
    {
        return _prices[tokenId];
    }

    /**
     * @notice Sets the price for a specific token ID.
     * @dev ONLY callable by the admin address. This is temporary for Phase 1.
     */
    function setPrice(uint256 tokenId, uint256 price) external {
        require(msg.sender == _adminAddress, "PricingOracle: Caller is not the admin");
        _prices[tokenId] = price;
        emit PriceUpdated(tokenId, price);
    }
}