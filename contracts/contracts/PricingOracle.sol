// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

contract PricingOracle is ReentrancyGuard, FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    mapping(uint256 => uint256) private prices;
    mapping(bytes32 => uint256) public activeRequests;
    
    address public immutable chainlinkRouter;
    bytes32 public donId;
    string public jsSourceCode;
    uint64 public subscriptionId;
    address public immutable admin;
    uint32 public constant CALLBACK_GAS_LIMIT = 300_000;

    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event PriceRequestSent(bytes32 indexed requestId, uint256 indexed tokenId);
    event PriceRequestError(bytes32 indexed requestId, bytes error);
    event FunctionsScriptUpdated(string newScript);
    event SubscriptionIdUpdated(uint64 newSubId);

    error Unauthorized();
    error SubscriptionNotSet();
    error ScriptNotSet();
    error InvalidTokenId();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    constructor(address _router, bytes32 _donId) FunctionsClient(_router) {
        chainlinkRouter = _router;
        donId = _donId;
        admin = msg.sender;
    }

    function setFunctionsScript(string calldata _jsSourceCode) external onlyAdmin {
        jsSourceCode = _jsSourceCode;
        emit FunctionsScriptUpdated(_jsSourceCode);
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyAdmin {
        subscriptionId = _subscriptionId;
        emit SubscriptionIdUpdated(_subscriptionId);
    }

    function setDonId(bytes32 _donId) external onlyAdmin {
        donId = _donId;
    }

    function requestPriceUpdate(uint256 tokenId) external nonReentrant {
        if (subscriptionId == 0) revert SubscriptionNotSet();
        if (bytes(jsSourceCode).length == 0) revert ScriptNotSet();

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(jsSourceCode);

        string[] memory args = new string[](1);
        args[0] = _toString(tokenId);
        req.setArgs(args);

        bytes32 requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            CALLBACK_GAS_LIMIT,
            donId
        );

        activeRequests[requestId] = tokenId;
        emit PriceRequestSent(requestId, tokenId);
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        uint256 tokenId = activeRequests[requestId];
        if (tokenId == 0) return;

        if (err.length > 0) {
            emit PriceRequestError(requestId, err);
            delete activeRequests[requestId];
            return;
        }

        uint256 newPrice = abi.decode(response, (uint256));
        prices[tokenId] = newPrice;
        emit PriceUpdated(tokenId, newPrice);
        delete activeRequests[requestId];
    }

    function getPrice(uint256 tokenId) external view returns (uint256) {
        return prices[tokenId];
    }

    function isRequestPending(bytes32 requestId) external view returns (bool) {
        return activeRequests[requestId] != 0;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}