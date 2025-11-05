// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// --- FIXED INTERFACES ---
interface ITicketNFT {
    // --- REQUIRED FUNCTIONS ---
    function getTokenState(uint256 tokenId) external view returns (uint8); // 0=IDLE, 1=STAKED, etc.
    function ownerOf(uint256 tokenId) external view returns (address);
    function setTokenState(uint256 tokenId, uint8 newState) external; // We'll use 0=IDLE, 1=STAKED
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IPricingOracle {
    function getPrice(uint256 tokenId) external view returns (uint256);
}

contract StakingVault is ReentrancyGuard,IERC721Receiver {
    
    // --- State Variables ---
    ITicketNFT public immutable ticketNFT;
    IPricingOracle public immutable pricingOracle;
    
    struct StakeInfo {
        address owner;
        uint256 stakeTimestamp;
        uint256 initialValue;
    }
    
    mapping(uint256 => StakeInfo) public stakeInfo;
    mapping(address => uint256) public userStakedValue;
    uint256 public totalStakedValue;
    
    // --- Events ---
    event TokenStaked(address indexed user, uint256 indexed tokenId, uint256 value);
    event TokenUnstaked(address indexed user, uint256 indexed tokenId, uint256 value);
    
    // --- Constructor ---
    constructor(address _ticketNFTAddress, address _oracleAddress) {
        require(_ticketNFTAddress != address(0), "StakingVault: Invalid NFT address");
        require(_oracleAddress != address(0), "StakingVault: Invalid oracle address");
        
        ticketNFT = ITicketNFT(_ticketNFTAddress);
        pricingOracle = IPricingOracle(_oracleAddress);
    }
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
    // This selector is the "magic value" that confirms the contract
    // is aware it is receiving an NFT.
        return this.onERC721Received.selector;
    }
    
    // --- Stake Function ---
    function stake(uint256 tokenId) external nonReentrant {
        // --- 1. CHECKS ---
        
        // Check: Is msg.sender the owner of this token?
        address tokenOwner = ticketNFT.ownerOf(tokenId);
        require(tokenOwner == msg.sender, "StakingVault: You don't own this token");
        
        // Check: Is the token in IDLE state?
        uint8 state = ticketNFT.getTokenState(tokenId);
        require(state == 0, "StakingVault: Token is not IDLE"); // 0 = IDLE
        
        // Check: Does the token have a price?
        uint256 price = pricingOracle.getPrice(tokenId);
        require(price > 0, "StakingVault: Token has no price");
        
        // Check: Is this token already staked?
        require(stakeInfo[tokenId].owner == address(0), "StakingVault: Token already staked");
        
        // --- 2. EFFECTS (Update state BEFORE external calls) ---
        
        // Record the stake information
        stakeInfo[tokenId] = StakeInfo({
            owner: msg.sender,
            stakeTimestamp: block.timestamp,
            initialValue: price
        });
        
        // Update user's staked value
        userStakedValue[msg.sender] += price;
        
        // Update total staked value
        totalStakedValue += price;
        
        // --- 3. INTERACTIONS (External calls LAST) ---
        
        // 1. Transfer the NFT from the user to this vault
        //    (Requires user to have called ticketNFT.approve(this_address, tokenId) first!)
        ticketNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        
        // 2. Call the TicketNFT contract to update its state to STAKED
        //    This contract *is* a "protocol" address, so it has permission.
        ticketNFT.setTokenState(tokenId, 1); // 1 = STAKED
        
        // --- 4. EVENT ---
        emit TokenStaked(msg.sender, tokenId, price);
    }
    
    // --- Unstake Function ---
    function unstake(uint256 tokenId) external nonReentrant {
        // --- 1. CHECKS ---
        
        // Check: Does this stake exist?
        StakeInfo memory info = stakeInfo[tokenId];
        require(info.owner != address(0), "StakingVault: Token not staked");
        
        // Check: Is msg.sender the original staker?
        require(info.owner == msg.sender, "StakingVault: Not your stake");

        // Check: Is the token actually in this contract?
        // The TicketNFT's _update function already protects against
        // the token being transferred out by anyone else.
        
        // --- 2. EFFECTS (Update state BEFORE external calls) ---
        
        // Remove stake info
        delete stakeInfo[tokenId];
        
        // Update user's staked value
        userStakedValue[msg.sender] -= info.initialValue;
        
        // Update total staked value
        totalStakedValue -= info.initialValue;
        
        // --- 3. INTERACTIONS (External calls LAST) ---
        
        // 1. Call the TicketNFT contract to set its state back to IDLE
        //    This allows the NFT to be transferred again.
        ticketNFT.setTokenState(tokenId, 0); // 0 = IDLE
        
        // 2. Transfer the NFT from this vault back to the original owner
        ticketNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        
        // --- 4. EVENT ---
        emit TokenUnstaked(msg.sender, tokenId, info.initialValue);
    }
    
    // --- View Functions (Unchanged) ---
    // ...
    // --- View Functions ---
    
    /**
     * @notice Get stake information for a token.
     * @param tokenId The token ID to query.
     * @return owner The address that staked the token
     * @return stakeTimestamp When the token was staked
     * @return initialValue The value of the token when staked
     */
    function getStakeInfo(uint256 tokenId) external view returns (
        address owner,
        uint256 stakeTimestamp,
        uint256 initialValue
    ) {
        StakeInfo memory info = stakeInfo[tokenId];
        return (info.owner, info.stakeTimestamp, info.initialValue);
    }
    
    /**
     * @notice Check if a token is staked in this vault.
     * @param tokenId The token ID to check.
     * @return True if the token is staked, false otherwise.
     */
    function isStaked(uint256 tokenId) external view returns (bool) {
        return stakeInfo[tokenId].owner != address(0);
    }
    
    /**
     * @notice Get the total value staked by a user.
     * @param user The user address to query.
     * @return The total USD value of tokens staked by the user.
     */
    function getUserStakedValue(address user) external view returns (uint256) {
        return userStakedValue[user];
    }
}