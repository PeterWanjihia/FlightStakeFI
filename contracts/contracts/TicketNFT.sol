// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract TicketNFT is ERC721URIStorage {
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

    mapping(uint256 => FlightDetails) private _flightDetails;
    mapping(uint256 => State) private _tokenState;

    address public immutable i_minterAddress;

    address public stakingVaultAddress;
    address public lendingPoolAddress;
    address public marketplaceAddress;

    error TicketNFT__NotMinter();
    error TicketNFT__NotProtocol();
    error TicketNFT__TokenDoesNotExist(uint256 tokenId);
    error TicketNFT__TransferNotAllowedInState(State currentState);

    modifier onlyMinter() {
        if (msg.sender != i_minterAddress) {
            revert TicketNFT__NotMinter();
        }
        _;
    }

    modifier onlyProtocol() {
        if (
            msg.sender != stakingVaultAddress &&
            msg.sender != lendingPoolAddress &&
            msg.sender != marketplaceAddress
        ) {
            revert TicketNFT__NotProtocol();
        }
        _;
    }

    constructor() ERC721("FlightTicketNFT", "FTN") {
        i_minterAddress = msg.sender;
    }

    function setStakingVault(address _vaultAddress) external onlyMinter {
        stakingVaultAddress = _vaultAddress;
    }

    function setLendingPool(address _poolAddress) external onlyMinter {
        lendingPoolAddress = _poolAddress;
    }

    function setMarketplace(address _marketplaceAddress) external onlyMinter {
        marketplaceAddress = _marketplaceAddress;
    }

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

    function setTokenState(uint256 tokenId, State newState)
        external
        onlyProtocol
    {
        _setTokenState(tokenId, newState);
    }

    function _setTokenState(uint256 tokenId, State newState) internal {
        _tokenState[tokenId] = newState;
    }

    function getFlightDetails(uint256 tokenId)
        external
        view
        returns (FlightDetails memory)
    {
        return _flightDetails[tokenId];
    }

    function getTokenState(uint256 tokenId) external view returns (State) {
        return _tokenState[tokenId];
    }

    function getMinter() external view returns (address) {
        return i_minterAddress;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from == address(0)) {
            return super._update(to, tokenId, auth);
        }

        if (to == address(0)) {
            return super._update(to, tokenId, auth);
        }

        State currentState = _tokenState[tokenId];

        if (currentState == State.IDLE) {
            return super._update(to, tokenId, auth);
        }

        if (currentState == State.STAKED && msg.sender == stakingVaultAddress) {
            return super._update(to, tokenId, auth);
        }

        if (
            currentState == State.COLLATERALIZED &&
            msg.sender == lendingPoolAddress
        ) {
            return super._update(to, tokenId, auth);
        }

        if (currentState == State.LISTED && msg.sender == marketplaceAddress) {
            return super._update(to, tokenId, auth);
        }

        revert TicketNFT__TransferNotAllowedInState(currentState);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

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