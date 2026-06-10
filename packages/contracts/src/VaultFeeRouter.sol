// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  VaultFeeRouter
 * @notice Routes all Vault trades and payments, deducting the protocol fee
 *         before forwarding to the DEX router or recipient wallet.
 *
 * @dev    Security properties:
 *         - ReentrancyGuard on all external state-changing functions
 *         - treasuryAddress is IMMUTABLE after deployment
 *         - feeBps has a hardcoded maximum of 100 (1%) — cannot exceed
 *         - No upgradeable proxy — what you audit is what runs
 *
 *         AUDIT REQUIRED before mainnet deployment.
 */
contract VaultFeeRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice Immutable treasury address — receives all protocol fees
    /// @dev    Set at construction, CANNOT be changed. Protects users.
    address public immutable treasuryAddress;

    /// @notice Current fee in basis points (50 = 0.5%)
    uint256 public feeBps;

    /// @notice Maximum fee — hardcoded, cannot be overridden
    uint256 public constant MAX_FEE_BPS = 100; // 1%

    /// @notice Uniswap V3 SwapRouter address (mainnet)
    address public uniswapRouter;

    // ── Events ────────────────────────────────────────────────────────────────

    event PaymentRouted(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        uint256 fee
    );

    event TradeRouted(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 fee,
        bytes32 txRef
    );

    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address _treasury,
        address _uniswapRouter,
        uint256 _feeBps
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "VaultFeeRouter: zero treasury");
        require(_feeBps <= MAX_FEE_BPS, "VaultFeeRouter: fee exceeds max");

        treasuryAddress = _treasury;
        uniswapRouter   = _uniswapRouter;
        feeBps          = _feeBps;
    }

    // ── P2P Payment routing ───────────────────────────────────────────────────

    /**
     * @notice Route a native ETH payment from sender to recipient.
     *         Deducts feeBps from msg.value, sends remainder to recipient.
     * @param  recipient  The wallet receiving the payment
     */
    function routeEthPayment(address payable recipient)
        external
        payable
        nonReentrant
    {
        require(msg.value > 0, "VaultFeeRouter: zero value");
        require(recipient != address(0), "VaultFeeRouter: zero recipient");

        uint256 fee    = (msg.value * feeBps) / 10_000;
        uint256 amount = msg.value - fee;

        // Send fee to treasury
        (bool feeOk,) = payable(treasuryAddress).call{value: fee}("");
        require(feeOk, "VaultFeeRouter: treasury transfer failed");

        // Send net amount to recipient
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "VaultFeeRouter: recipient transfer failed");

        emit PaymentRouted(msg.sender, recipient, address(0), amount, fee);
    }

    /**
     * @notice Route an ERC-20 token payment.
     *         Caller must first approve this contract for `totalAmount`.
     * @param  token        ERC-20 token contract address
     * @param  recipient    Receiving wallet
     * @param  totalAmount  Gross amount (fee deducted from this)
     */
    function routeTokenPayment(
        address token,
        address recipient,
        uint256 totalAmount
    ) external nonReentrant {
        require(totalAmount > 0, "VaultFeeRouter: zero amount");
        require(recipient != address(0), "VaultFeeRouter: zero recipient");

        uint256 fee    = (totalAmount * feeBps) / 10_000;
        uint256 amount = totalAmount - fee;

        IERC20(token).safeTransferFrom(msg.sender, treasuryAddress, fee);
        IERC20(token).safeTransferFrom(msg.sender, recipient, amount);

        emit PaymentRouted(msg.sender, recipient, token, amount, fee);
    }

    // ── Trade routing ─────────────────────────────────────────────────────────

    /**
     * @notice Route a DEX swap via Uniswap V3.
     *         Takes fee from ETH input, forwards remainder to Uniswap router.
     * @param  swapCalldata  Encoded Uniswap exactInputSingle calldata
     * @param  txRef         Off-chain reference for event tracking
     */
    function routeSwapEth(bytes calldata swapCalldata, bytes32 txRef)
        external
        payable
        nonReentrant
    {
        require(msg.value > 0, "VaultFeeRouter: zero value");

        uint256 fee       = (msg.value * feeBps) / 10_000;
        uint256 swapValue = msg.value - fee;

        // Fee to treasury
        (bool feeOk,) = payable(treasuryAddress).call{value: fee}("");
        require(feeOk, "VaultFeeRouter: treasury transfer failed");

        // Execute swap via Uniswap router
        (bool swapOk,) = uniswapRouter.call{value: swapValue}(swapCalldata);
        require(swapOk, "VaultFeeRouter: swap failed");

        emit TradeRouted(
            msg.sender, address(0), address(0), msg.value, fee, txRef
        );
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Update the protocol fee. Owner only. Cannot exceed MAX_FEE_BPS.
     */
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "VaultFeeRouter: fee exceeds max");
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    /**
     * @notice Update the Uniswap router address. Owner only.
     */
    function setUniswapRouter(address _router) external onlyOwner {
        require(_router != address(0), "VaultFeeRouter: zero address");
        uniswapRouter = _router;
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function calculateFee(uint256 amount) external view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    function calculateNetAmount(uint256 grossAmount) external view returns (uint256) {
        return grossAmount - (grossAmount * feeBps) / 10_000;
    }

    // ── Safety ────────────────────────────────────────────────────────────────

    /// @dev Reject direct ETH sends (must use routeEthPayment)
    receive() external payable {
        revert("VaultFeeRouter: use routeEthPayment");
    }

    fallback() external payable {
        revert("VaultFeeRouter: invalid call");
    }
}
