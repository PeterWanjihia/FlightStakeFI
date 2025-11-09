// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ILendingPool {
    function getHealthFactor(address user) external view returns (uint256);
    function getOutstandingDebt(address user) external view returns (uint256);
    function seizeCollateral(address user, address liquidator) external;
}

interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LiquidationEngine is ReentrancyGuard {
    ILendingPool public immutable lendingPool;
    IUSDC public immutable usdc;
    
    uint256 private constant HF_PRECISION = 1e18;
    
    event LiquidationExecuted(
        address indexed liquidator,
        address indexed user,
        uint256 debtPaid
    );
    
    constructor(address _lendingPoolAddress, address _usdcAddress) {
        lendingPool = ILendingPool(_lendingPoolAddress);
        usdc = IUSDC(_usdcAddress);
    }
    
    function liquidate(address user) external nonReentrant {
        uint256 healthFactor = lendingPool.getHealthFactor(user);
        require(healthFactor < HF_PRECISION, "LiquidationEngine: Loan is healthy");
        
        uint256 debtToPay = lendingPool.getOutstandingDebt(user);
        require(debtToPay > 0, "LiquidationEngine: No debt to pay");
        
        bool success = usdc.transferFrom(msg.sender, address(lendingPool), debtToPay);
        require(success, "LiquidationEngine: Debt payment failed");
        
        lendingPool.seizeCollateral(user, msg.sender);
        
        emit LiquidationExecuted(msg.sender, user, debtToPay);
    }
}