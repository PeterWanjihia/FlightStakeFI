// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// We inherit from ERC721URIStorage (which already inherits ERC721)
contract TicketNFT is ERC721URIStorage {
    // ===========*CUSTOM DATA TYPES*==========
    enum State {
        IDLE,
        STAKED,
        COLLATERALIZED,
        LISTED
    }

    struct FlightDetails {
        string routeHash;
        uint256 departureTimestamp;
        bytes32 fareTierIdentifier;
    }

    // ===========*STATE VARIABLES*==========
    mapping(uint256 => FlightDetails) private _flightDetails;
    mapping(uint256 => State) private _tokenState;

    // The minter/admin address is set once and can never be changed
    address public immutable i_minterAddress;

    // Trusted protocol contract addresses
    address public stakingVaultAddress;
    address public lendingPoolAddress;
    // (We can add marketplaceAddress here later if needed)

    // ===========*CUSTOM ERRORS*==========
    error TicketNFT__NotMinter();
    error TicketNFT__NotProtocol();
    error TicketNFT__TokenDoesNotExist(uint256 tokenId);
    error TicketNFT__TransferNotAllowedInState(State currentState);

    // ===========*MODIFIERS*==========
    modifier onlyMinter() {
        if (msg.sender != i_minterAddress) {
            revert TicketNFT__NotMinter();
        }
        _;
    }

    modifier onlyProtocol() {
        if (
            msg.sender != stakingVaultAddress && msg.sender != lendingPoolAddress
            // (We'll add || msg.sender == marketplaceAddress here later)
        ) {
            revert TicketNFT__NotProtocol();
        }
        _;
    }

    // ===========*CONSTRUCTOR*==========
    constructor() ERC721("FlightTicketNFT", "FTN") {
        i_minterAddress = msg.sender;
    }

    // ===========*ADMIN FUNCTIONS*==========
    function setStakingVault(address _vaultAddress) external onlyMinter {
        stakingVaultAddress = _vaultAddress;
    }

    function setLendingPool(address _poolAddress) external onlyMinter {
        lendingPoolAddress = _poolAddress;
    }

    // ===========*CORE FUNCTIONS*==========
    function mint(
        address to,
        uint256 tokenId,
        FlightDetails memory details,
        string memory tokenURI_
    ) external onlyMinter {
        _mint(to, tokenId);
        _flightDetails[tokenId] = details;
        _tokenState[tokenId] = State.IDLE;
        _setTokenURI(tokenId, tokenURI_);
    }

    // ===========*STATE MANAGEMENT (PROTOCOL-ONLY)*==========

    function setTokenState(uint256 tokenId, uint8 newState)
        external
        onlyProtocol
    {
        // Cast the uint8 to the State enum
        _setTokenState(tokenId, State(newState));
    }

    function _setTokenState(uint256 tokenId, State newState) internal {
        _tokenState[tokenId] = newState;
    }

    // ===========*GETTER FUNCTIONS*==========
    function getFlightDetails(uint256 tokenId)
        external
        view
        returns (FlightDetails memory)
    {
        return _flightDetails[tokenId];
    }

    function getTokenState(uint256 tokenId) external view returns (uint8) {
        // Cast the internal State enum to a uint8
        return uint8(_tokenState[tokenId]);
    }

    function getMinter() external view returns (address) {
        return i_minterAddress;
    }

    // ===========*OVERRIDES (SECURITY GUARD & REQUIRED)*==========

    /**
     * @dev This is our upgraded "Security Guard".
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override // <--- FIX #1 (Removed the list)
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // Allow minting
        if (from == address(0)) {
            return super._update(to, tokenId, auth);
        }

        // Allow burning
        if (to == address(0)) {
            return super._update(to, tokenId, auth);
        }

        State currentState = _tokenState[tokenId];

        // 1. Allow if IDLE
        if (currentState == State.IDLE) {
            return super._update(to, tokenId, auth);
        }

        // 2. Allow StakingVault to move STAKED tokens (for unstaking)
        if (currentState == State.STAKED && msg.sender == stakingVaultAddress) {
            return super._update(to, tokenId, auth);
        }

        // 3. Allow LendingPool to move COLLATERALIZED tokens (for liquidations/withdrawals)
        if (
            currentState == State.COLLATERALIZED &&
            msg.sender == lendingPoolAddress
        ) {
            return super._update(to, tokenId, auth);
        }

        // 4. Reject all other transfers
        revert TicketNFT__TransferNotAllowedInState(currentState);
    }

    /**
     * @dev Required override for ERC721URIStorage.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override // <--- FIX #2 (Removed the list)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev Required override for ERC721URIStorage.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override // <--- FIX #3 (Removed the list)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ===========*TEST-ONLY FUNCTIONS*==========
    function changeState_TEMPORARY(uint256 tokenId, State newState)
        external
        onlyMinter
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert TicketNFT__TokenDoesNotExist(tokenId);
        }
        _setTokenState(tokenId, newState);
    }
}