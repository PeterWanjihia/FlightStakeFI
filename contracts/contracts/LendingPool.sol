// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

enum State {
    IDLE,
    STAKED,
    COLLATERALIZED,
    LISTED
}

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
    
    mapping(address => uint256[]) private s_userCollateralTokenIds;
    mapping(uint256 => address) public collateralOwner;
    mapping(address => uint256) public userDebt;
    mapping(address => uint256) public lastInterestUpdate;
    
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant RATE_PRECISION = 10000;
    uint256 private constant HF_PRECISION = 1e18;

    event CollateralDeposited(address indexed user, uint256 indexed tokenId, uint256 value);
    event CollateralWithdrawn(address indexed user, uint256 indexed tokenId, uint256 value);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event LiquidationEngineSet(address indexed engine);
    event RiskParametersUpdated(uint256 ltv, uint256 threshold, uint256 rate);
    event CollateralSeized(address indexed user, address indexed liquidator, uint256[] tokenIds);

    modifier onlyLiquidationEngine() {
        require(msg.sender == liquidationEngineAddress, "LendingPool: Not the liquidation engine");
        _;
    }

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
    
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    
    function setRiskParameters(uint256 _ltv, uint256 _thresh, uint256 _rate) external {
        require(msg.sender == i_admin, "LendingPool: Not admin");
        loanToValue = _ltv;
        liquidationThreshold = _thresh;
        interestRate = _rate;
        emit RiskParametersUpdated(_ltv, _thresh, _rate);
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

    function depositCollateral(uint256 tokenId) external nonReentrant {
        address tokenOwner = ticketNFT.ownerOf(tokenId);
        require(tokenOwner == msg.sender, "LendingPool: Not the token owner");
        State state = ticketNFT.getTokenState(tokenId);
        require(state == State.IDLE, "LendingPool: Token is not IDLE");
        uint256 price = pricingOracle.getPrice(tokenId);
        require(price > 0, "LendingPool: Token has no price");
        require(collateralOwner[tokenId] == address(0), "LendingPool: Token already deposited");
        s_userCollateralTokenIds[msg.sender].push(tokenId);
        collateralOwner[tokenId] = msg.sender;
        ticketNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        ticketNFT.setTokenState(tokenId, State.COLLATERALIZED); 
        emit CollateralDeposited(msg.sender, tokenId, price);
    }

    function borrow(uint256 amount) external nonReentrant {
        _updateInterest(msg.sender);
        uint256 collateralValue = _calculateCollateralValue(msg.sender);
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

    function repay(uint256 amount) external nonReentrant returns (uint256) {
        _updateInterest(msg.sender); 
        uint256 currentDebt = userDebt[msg.sender];
        require(currentDebt > 0, "LendingPool: No debt to repay");
        uint256 amountToRepay = amount;
        if (amount > currentDebt) {
            amountToRepay = currentDebt;
        }
        userDebt[msg.sender] -= amountToRepay; 
        if (userDebt[msg.sender] == 0) {
            lastInterestUpdate[msg.sender] = 0;
        }
        bool success = usdc.transferFrom(msg.sender, address(this), amountToRepay);
        require(success, "LendingPool: USDC transfer failed");
        emit Repaid(msg.sender, amountToRepay);
        return amountToRepay;
    }

    function repayAll() external nonReentrant returns (uint256) {
        _updateInterest(msg.sender);
        uint256 currentDebt = userDebt[msg.sender];
        require(currentDebt > 0, "LendingPool: No debt to repay");
        userDebt[msg.sender] = 0;
        lastInterestUpdate[msg.sender] = 0;
        bool success = usdc.transferFrom(msg.sender, address(this), currentDebt);
        require(success, "LendingPool: USDC transfer failed");
        emit Repaid(msg.sender, currentDebt);
        return currentDebt;
    }

    function withdrawCollateral(uint256 tokenId) external nonReentrant {
        require(collateralOwner[tokenId] == msg.sender, "LendingPool: Not collateral owner");
        _updateInterest(msg.sender);
        uint256 currentDebt = userDebt[msg.sender];
        _removeTokenFromUserList(msg.sender, tokenId);
        collateralOwner[tokenId] = address(0);
        uint256 newCollateralValue = _calculateCollateralValue(msg.sender);
        uint256 newBorrowLimit = (newCollateralValue * loanToValue) / 100;
        require(currentDebt <= newBorrowLimit, "LendingPool: Insufficient remaining collateral");
        ticketNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        ticketNFT.setTokenState(tokenId, State.IDLE);
        uint256 price = pricingOracle.getPrice(tokenId); 
        emit CollateralWithdrawn(msg.sender, tokenId, price);
    }

    function seizeCollateral(address user, address liquidator) external onlyLiquidationEngine {
        uint256[] memory tokenIds = s_userCollateralTokenIds[user];
        require(tokenIds.length > 0, "LendingPool: No collateral to seize");
        delete s_userCollateralTokenIds[user];
        userDebt[user] = 0;
        lastInterestUpdate[user] = 0;
        for (uint i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            collateralOwner[tokenId] = address(0);
            ticketNFT.safeTransferFrom(address(this), liquidator, tokenId);
            ticketNFT.setTokenState(tokenId, State.IDLE);
        }
        emit CollateralSeized(user, liquidator, tokenIds);
    }

    function _updateInterest(address user) internal {
        uint256 currentDebt = userDebt[user];
        if (currentDebt == 0) { return; }
        uint256 lastUpdate = lastInterestUpdate[user];
        if (lastUpdate == block.timestamp) { return; }
        uint256 timeElapsed = block.timestamp - lastUpdate;
        uint256 accruedInterest = (currentDebt * interestRate * timeElapsed) /
            (SECONDS_PER_YEAR * RATE_PRECISION);
        userDebt[user] = currentDebt + accruedInterest;
        lastInterestUpdate[user] = block.timestamp;
    }

    function _removeTokenFromUserList(address user, uint256 tokenId) internal {
        uint256[] storage tokenIds = s_userCollateralTokenIds[user];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == tokenId) {
                tokenIds[i] = tokenIds[tokenIds.length - 1];
                tokenIds.pop();
                return;
            }
        }
    }

    function _calculateCollateralValue(address user) internal view returns (uint256) {
        uint256 totalValue = 0;
        uint256[] memory tokenIds = s_userCollateralTokenIds[user];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            totalValue += pricingOracle.getPrice(tokenIds[i]);
        }
        return totalValue;
    }

    function getOutstandingDebt(address user) public view returns (uint256) {
        uint256 currentDebt = userDebt[user];
        if (currentDebt == 0) { return 0; }
        uint256 lastUpdate = lastInterestUpdate[user];
        if (lastUpdate == block.timestamp) { return currentDebt; }
        uint256 timeElapsed = block.timestamp - lastUpdate;
        uint256 accruedInterest = (currentDebt * interestRate * timeElapsed) / (SECONDS_PER_YEAR * RATE_PRECISION);
        return currentDebt + accruedInterest;
    }
    
    function getHealthFactor(address user) public view returns (uint256) {
        uint256 collateralValue = _calculateCollateralValue(user);
        uint256 currentDebt = getOutstandingDebt(user);
        if (currentDebt == 0) {
            return type(uint256).max;
        }
        uint256 liquidationValue = (collateralValue * liquidationThreshold) / 100;
        return (liquidationValue * HF_PRECISION) / currentDebt;
    }

    function getCollateralTokenIds(address user) external view returns (uint256[] memory) {
        return s_userCollateralTokenIds[user];
    }
}