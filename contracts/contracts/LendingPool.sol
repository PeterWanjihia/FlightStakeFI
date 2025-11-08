// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// --- NEW: We must define the enum so this contract understands it ---
enum State {
    IDLE,
    STAKED,
    COLLATERALIZED,
    LISTED
}

// --- MODIFIED: The "menu" now uses the 'State' enum ---
interface ITicketNFT {
    function getTokenState(uint256 tokenId) external view returns (State);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function setTokenState(uint256 tokenId, State newState) external;
}

interface IPricingOracle {
    function getPrice(uint256 tokenId) external view returns (uint256);
}

interface IUSDC {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract LendingPool is ReentrancyGuard, IERC721Receiver {
    ITicketNFT public immutable ticketNFT;
    IPricingOracle public immutable pricingOracle;
    IUSDC public immutable usdc;
    
    address public liquidationEngineAddress;
    
    uint256 public loanToValue;
    uint256 public liquidationThreshold;
    uint256 public interestRate;
    
    address public immutable i_admin;
    
    mapping(address => uint256) public userCollateralValue;
    mapping(address => uint256) public userDebt;
    mapping(uint256 => address) public collateralOwner;
    mapping(address => uint256) public lastInterestUpdate;
    
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant RATE_PRECISION = 10000;
    
    event CollateralDeposited(address indexed user, uint256 indexed tokenId, uint256 value);
    event CollateralWithdrawn(address indexed user, uint256 indexed tokenId, uint256 value);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event LiquidationEngineSet(address indexed engine);
    event RiskParametersUpdated(uint256 ltv, uint256 threshold, uint256 rate);
    
    constructor(
        address _ticketNFTAddress,
        address _oracleAddress,
        address _usdcAddress
    ) {
        ticketNFT = ITicketNFT(_ticketNFTAddress);
        pricingOracle = IPricingOracle(_oracleAddress);
        usdc = IUSDC(_usdcAddress);
        i_admin = msg.sender;
    }
    
    // --- CRITICAL: ERC721 Receiver Implementation ---
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    // --- Admin Functions ---
    function setRiskParameters(
        uint256 _loanToValue,
        uint256 _liquidationThreshold,
        uint256 _interestRate
    ) external {
        require(msg.sender == i_admin, "LendingPool: Not admin");
        loanToValue = _loanToValue;
        liquidationThreshold = _liquidationThreshold;
        interestRate = _interestRate;
        emit RiskParametersUpdated(_loanToValue, _liquidationThreshold, _interestRate);
    }
    
    function setLiquidationEngine(address _engineAddress) external {
        require(msg.sender == i_admin, "LendingPool: Not admin");
        liquidationEngineAddress = _engineAddress;
        emit LiquidationEngineSet(_engineAddress);
    }
    
    function fundPool(uint256 amount) external {
        require(msg.sender == i_admin, "LendingPool: Not admin");
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "LendingPool: USDC transfer failed");
    }
    
    function withdrawPoolFunds(uint256 amount) external {
        require(msg.sender == i_admin, "LendingPool: Not admin");
        uint256 balance = usdc.balanceOf(address(this));
        require(balance >= amount, "LendingPool: Insufficient funds");
        bool success = usdc.transfer(msg.sender, amount);
        require(success, "LendingPool: USDC transfer failed");
    }
    
    // --- USER FUNCTIONS ---
    function depositCollateral(uint256 tokenId) external nonReentrant {
        // --- 1. CHECKS ---
        address tokenOwner = ticketNFT.ownerOf(tokenId);
        require(tokenOwner == msg.sender, "LendingPool: Not the token owner");
        
        // --- MODIFIED: Check for the correct enum state ---
        State state = ticketNFT.getTokenState(tokenId);
        require(state == State.IDLE, "LendingPool: Token is not IDLE");
        
        uint256 price = pricingOracle.getPrice(tokenId);
        require(price > 0, "LendingPool: Token has no price");
        require(collateralOwner[tokenId] == address(0), "LendingPool: Token already deposited");
        
        // --- 2. EFFECTS ---
        userCollateralValue[msg.sender] += price;
        collateralOwner[tokenId] = msg.sender;
        
        // --- 3. INTERACTIONS ---
        ticketNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        
        // --- MODIFIED: Set the correct enum state ---
        ticketNFT.setTokenState(tokenId, State.COLLATERALIZED); 
        
        // --- 4. EVENT ---
        emit CollateralDeposited(msg.sender, tokenId, price);
    }
    
    function borrow(uint256 amount) external nonReentrant {
        _updateInterest(msg.sender);
        
        uint256 collateralValue = userCollateralValue[msg.sender];
        require(collateralValue > 0, "LendingPool: No collateral deposited");
        
        uint256 borrowLimit = (collateralValue * loanToValue) / 100;
        uint256 newDebt = userDebt[msg.sender] + amount;
        require(newDebt <= borrowLimit, "LendingPool: Amount exceeds borrow limit");
        
        require(usdc.balanceOf(address(this)) >= amount, "LendingPool: Insufficient liquidity");
        
        userDebt[msg.sender] = newDebt;
        if (lastInterestUpdate[msg.sender] == 0) {
            lastInterestUpdate[msg.sender] = block.timestamp;
        }
        
        bool success = usdc.transfer(msg.sender, amount);
        require(success, "LendingPool: USDC transfer failed");
        
        emit Borrowed(msg.sender, amount);
    }
    
    // --- INTERNAL FUNCTIONS ---
    function _updateInterest(address user) internal {
        uint256 currentDebt = userDebt[user];
        if (currentDebt == 0) {
            return;
        }
        
        uint256 lastUpdate = lastInterestUpdate[user];
        if (lastUpdate == block.timestamp) {
            return;
        }
        
        uint256 timeElapsed = block.timestamp - lastUpdate;
        uint256 accruedInterest = (currentDebt * interestRate * timeElapsed) /
            (SECONDS_PER_YEAR * RATE_PRECISION);
        
        userDebt[user] = currentDebt + accruedInterest;
        lastInterestUpdate[user] = block.timestamp;
    }
}