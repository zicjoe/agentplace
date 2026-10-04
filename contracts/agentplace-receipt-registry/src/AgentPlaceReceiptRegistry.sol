// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentPlaceReceiptRegistry
/// @notice Immutable registry for privacy-safe hashes of selected AgentPlace Job receipts.
/// @dev This contract never stores raw Job content, provider secrets, user prompts, wallet keys, or funds.
///      Off-chain AgentPlace systems remain authoritative for the full receipt; this contract only proves
///      that a particular receipt hash was anchored at a specific block and timestamp.
contract AgentPlaceReceiptRegistry {
    struct ReceiptAnchor {
        bytes32 jobHash;
        bytes32 evidenceRoot;
        uint64 anchoredAt;
        uint64 blockNumber;
        address anchorer;
    }

    error Unauthorized();
    error ZeroAddress();
    error ZeroHash();
    error ReceiptAlreadyAnchored(bytes32 receiptHash);
    error ReceiptNotFound(bytes32 receiptHash);
    error NotPendingOwner();
    error OwnerIsImplicitAnchorer();

    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed jobHash,
        bytes32 indexed evidenceRoot,
        address anchorer,
        uint64 anchoredAt,
        uint64 blockNumber
    );
    event AnchorerAuthorizationChanged(address indexed anchorer, bool authorized);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferCancelled(address indexed owner, address indexed cancelledPendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    uint256 public constant REGISTRY_VERSION = 1;

    address public owner;
    address public pendingOwner;
    uint256 public totalAnchors;

    mapping(address => bool) private additionalAnchorers;
    mapping(bytes32 => ReceiptAnchor) private anchors;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedAnchorer() {
        if (!isAuthorizedAnchorer(msg.sender)) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Anchors one privacy-safe AgentPlace receipt commitment permanently.
    /// @param receiptHash keccak256 hash of the canonical off-chain AgentPlace receipt bytes.
    /// @param jobHash Privacy-safe hash of the canonical AgentPlace Job identifier/context.
    /// @param evidenceRoot Hash or Merkle root committing to the receipt's preserved evidence set.
    function anchorReceipt(bytes32 receiptHash, bytes32 jobHash, bytes32 evidenceRoot)
        external
        onlyAuthorizedAnchorer
    {
        if (receiptHash == bytes32(0) || jobHash == bytes32(0) || evidenceRoot == bytes32(0)) {
            revert ZeroHash();
        }
        if (anchors[receiptHash].anchoredAt != 0) revert ReceiptAlreadyAnchored(receiptHash);

        uint64 timestamp = uint64(block.timestamp);
        uint64 currentBlock = uint64(block.number);

        anchors[receiptHash] = ReceiptAnchor({
            jobHash: jobHash,
            evidenceRoot: evidenceRoot,
            anchoredAt: timestamp,
            blockNumber: currentBlock,
            anchorer: msg.sender
        });

        unchecked {
            ++totalAnchors;
        }

        emit ReceiptAnchored(receiptHash, jobHash, evidenceRoot, msg.sender, timestamp, currentBlock);
    }

    /// @notice Returns true only when the exact receipt hash has already been anchored.
    function isAnchored(bytes32 receiptHash) external view returns (bool) {
        return anchors[receiptHash].anchoredAt != 0;
    }

    /// @notice Reads the immutable anchor metadata for a receipt hash.
    function getAnchor(bytes32 receiptHash) external view returns (ReceiptAnchor memory anchor) {
        anchor = anchors[receiptHash];
        if (anchor.anchoredAt == 0) revert ReceiptNotFound(receiptHash);
    }

    /// @notice Checks whether an account may anchor receipts.
    /// @dev The current owner is always an authorized anchorer. Additional anchorers are explicit and revocable.
    function isAuthorizedAnchorer(address account) public view returns (bool) {
        return account == owner || additionalAnchorers[account];
    }

    /// @notice Adds or removes a non-owner receipt anchorer.
    function setAnchorer(address account, bool authorized) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        if (account == owner) revert OwnerIsImplicitAnchorer();
        additionalAnchorers[account] = authorized;
        emit AnchorerAuthorizationChanged(account, authorized);
    }

    /// @notice Starts a two-step ownership transfer. The new owner must explicitly accept.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Cancels a pending ownership transfer.
    function cancelOwnershipTransfer() external onlyOwner {
        address cancelledPendingOwner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferCancelled(owner, cancelledPendingOwner);
    }

    /// @notice Accepts ownership from the currently configured pending owner account.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }
}
