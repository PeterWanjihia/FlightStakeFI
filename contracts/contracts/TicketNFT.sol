// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract TicketNFT is ERC721, ERC721URIStorage {
    
    // --- Custom Data Types ---
    enum State { IDLE, STAKED, COLLATERALIZED, LISTED }
    
    struct FlightDetails {
        string routeHash;
        uint256 departureTimestamp;
        bytes32 fareTierIdentifier;
    }
    
    // --- State Variables ---
    mapping(uint256 => FlightDetails) private _flightDetails;
    mapping(uint256 => State) private _tokenState;
    address private _minterAddress;
    
    // --- Constructor ---
    constructor() ERC721("FlightTicketNFT", "FTN") {
        _minterAddress = msg.sender;
    }
    
    // --- Core Functions ---
    function mint(
        address to,
        uint256 tokenId,
        FlightDetails memory details,
        string memory tokenURI_
    ) external {
        require(msg.sender == _minterAddress, "TicketNFT: Caller is not the minter");
        _mint(to, tokenId);
        _flightDetails[tokenId] = details;
        _tokenState[tokenId] = State.IDLE;
        _setTokenURI(tokenId, tokenURI_);
    }
    
    // --- Getter Functions ---
    function getFlightDetails(uint256 tokenId)
        external
        view
        returns (FlightDetails memory)
    {
        return _flightDetails[tokenId];
    }
    
    function getTokenState(uint256 tokenId)
        external
        view
        returns (State)
    {
        return _tokenState[tokenId];
    }
    
    // --- Required Override Functions ---
    
    /**
     * @dev This is the hook that runs during token transfers in OpenZeppelin v5.x.
     * We override it to add our custom state-based transfer rules.
     * This function is our "Security Guard".
     *
     * @param to The address the token is being sent *to*.
     * @param tokenId The token ID being transferred.
     * @param auth The address authorized to perform the transfer.
     * @return The previous owner of the token.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)  // FIXED: Only override ERC721, not ERC721URIStorage
        returns (address)
    {
        // Get the current owner (will be address(0) for mints)
        address from = _ownerOf(tokenId);
        
        // Allow minting: transfer from address(0)
        if (from == address(0)) {
            return super._update(to, tokenId, auth);
        }
        
        // Allow burning: transfer to address(0)
        if (to == address(0)) {
            return super._update(to, tokenId, auth);
        }
        
        // For normal transfers: Check the token's state
        State currentState = _tokenState[tokenId];
        
        // Require the state to be IDLE for transfers
        // If the state is STAKED, COLLATERALIZED, or LISTED,
        // this will revert and prevent the transfer
        require(
            currentState == State.IDLE,
            "TicketNFT: Transfer not allowed in current state"
        );
        
        // If all checks pass, proceed with the transfer
        return super._update(to, tokenId, auth);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)  // This is correct - both override tokenURI
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)  // This is correct - both override supportsInterface
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // --- State Management Functions ---
    
    /**
     * @dev Updates the state of a token.
     * Add access control as needed for your use case.
     */
    function _setTokenState(uint256 tokenId, State newState) internal {
        _tokenState[tokenId] = newState;
    }
    
    // --- TEMPORARY TEST-ONLY FUNCTIONS ---
    // We add these so our JavaScript test file can
    // 1. Check who the minter is
    // 2. Change a token's state to test our security guard
    
    /**
     * @dev [TEST-ONLY] Returns the minter address.
     * REMOVE THIS BEFORE PRODUCTION DEPLOYMENT.
     */
    function getMinterAddress() external view returns (address) {
        return _minterAddress;
    }
    
    /**
     * @dev [TEST-ONLY] A temporary function to change a token's state
     * for testing our transfer security.
     * REMOVE THIS BEFORE PRODUCTION DEPLOYMENT.
     */
    function changeState_TEMPORARY(uint256 tokenId, State newState) external {
        require(msg.sender == _minterAddress, "TicketNFT: Caller is not the minter");
        require(_ownerOf(tokenId) != address(0), "TicketNFT: Token does not exist");
        _setTokenState(tokenId, newState);
    }
}