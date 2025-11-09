// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

enum State {
    IDLE,
    STAKED,
    COLLATERALIZED,
    LISTED
}
interface ITicketNFT {
    function getTokenState(uint256 tokenId) external view returns (State);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function setTokenState(uint256 tokenId, State newState) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Marketplace is ReentrancyGuard {
    
    ITicketNFT public immutable ticketNFT;
    IUSDC public immutable usdc;
    address public immutable i_admin;
    
    uint256 public protocolFeeBasisPoints;
    uint256 private constant MAX_FEE_BASIS_POINTS = 1000;
    uint256 private constant BASIS_POINTS_DIVISOR = 10000;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint256 => Listing) public s_listings;

    event ItemListed(address indexed seller, uint256 indexed tokenId, uint256 price);
    event ItemSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price);
    event ListingCancelled(address indexed seller, uint256 indexed tokenId);
    event FeeUpdated(uint256 newFee);

    error Marketplace__NotAdmin();
    error Marketplace__FeeTooHigh();
    error Marketplace__InvalidPrice();
    error Marketplace__NotTokenOwner();
    error Marketplace__TokenNotIdle();
    error Marketplace__NotApproved();
    error Marketplace__NotYourListing();
    error Marketplace__ItemNotForSale();
    error Marketplace__CannotBuyOwnItem();
    error Marketplace__USDCTransferFailed();
    error Marketplace__SellerPaymentFailed();
    error Marketplace__FeePaymentFailed();

    constructor(
        address _ticketNFTAddress,
        address _usdcAddress,
        uint256 _initialFee
    ) {
        if (_initialFee > MAX_FEE_BASIS_POINTS) revert Marketplace__FeeTooHigh();
        
        ticketNFT = ITicketNFT(_ticketNFTAddress);
        usdc = IUSDC(_usdcAddress);
        i_admin = msg.sender;
        protocolFeeBasisPoints = _initialFee;
    }

    function setFee(uint256 _newFee) external {
        if (msg.sender != i_admin) revert Marketplace__NotAdmin();
        if (_newFee > MAX_FEE_BASIS_POINTS) revert Marketplace__FeeTooHigh();
        
        protocolFeeBasisPoints = _newFee;
        emit FeeUpdated(_newFee);
    }

    function listItem(uint256 tokenId, uint256 price) external nonReentrant {
        if (price == 0) revert Marketplace__InvalidPrice();
        
        address tokenOwner = ticketNFT.ownerOf(tokenId);
        if (tokenOwner != msg.sender) revert Marketplace__NotTokenOwner();
        
        State state = ticketNFT.getTokenState(tokenId);
        if (state != State.IDLE) revert Marketplace__TokenNotIdle();
        
        address approved = ticketNFT.getApproved(tokenId);
        if (approved != address(this)) revert Marketplace__NotApproved();

        s_listings[tokenId] = Listing({
            seller: msg.sender,
            price: price
        });

        ticketNFT.setTokenState(tokenId, State.LISTED);
        
        emit ItemListed(msg.sender, tokenId, price);
    }

    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing memory listing = s_listings[tokenId];
        if (listing.seller != msg.sender) revert Marketplace__NotYourListing();

        delete s_listings[tokenId];
        ticketNFT.setTokenState(tokenId, State.IDLE);
        
        emit ListingCancelled(msg.sender, tokenId);
    }

    function buyItem(uint256 tokenId) external nonReentrant {
        Listing memory listing = s_listings[tokenId];
        address seller = listing.seller;
        uint256 price = listing.price;
        
        if (price == 0) revert Marketplace__ItemNotForSale();
        if (seller == msg.sender) revert Marketplace__CannotBuyOwnItem();

        delete s_listings[tokenId];

        if (protocolFeeBasisPoints > 0) {
            uint256 fee = (price * protocolFeeBasisPoints) / BASIS_POINTS_DIVISOR;
            uint256 proceeds = price - fee;

            if (!usdc.transferFrom(msg.sender, address(this), price)) {
                revert Marketplace__USDCTransferFailed();
            }
            if (!usdc.transfer(seller, proceeds)) {
                revert Marketplace__SellerPaymentFailed();
            }
            if (!usdc.transfer(i_admin, fee)) {
                revert Marketplace__FeePaymentFailed();
            }
        } else {
            if (!usdc.transferFrom(msg.sender, seller, price)) {
                revert Marketplace__USDCTransferFailed();
            }
        }

        ticketNFT.transferFrom(seller, msg.sender, tokenId);
        ticketNFT.setTokenState(tokenId, State.IDLE);
        
        emit ItemSold(seller, msg.sender, tokenId, price);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return s_listings[tokenId];
    }

    function getProtocolFee() external view returns (uint256) {
        return protocolFeeBasisPoints;
    }

    function getAdmin() external view returns (address) {
        return i_admin;
    }
}