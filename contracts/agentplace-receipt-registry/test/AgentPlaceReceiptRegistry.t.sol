// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPlaceReceiptRegistry} from "../src/AgentPlaceReceiptRegistry.sol";

contract RegistryCaller {
    function anchor(
        AgentPlaceReceiptRegistry registry,
        bytes32 receiptHash,
        bytes32 jobHash,
        bytes32 evidenceRoot
    ) external {
        registry.anchorReceipt(receiptHash, jobHash, evidenceRoot);
    }

    function acceptOwnership(AgentPlaceReceiptRegistry registry) external {
        registry.acceptOwnership();
    }
}

contract AgentPlaceReceiptRegistryTest {
    bytes32 private constant RECEIPT = keccak256("agentplace-receipt");
    bytes32 private constant JOB = keccak256("agentplace-job");
    bytes32 private constant EVIDENCE = keccak256("agentplace-evidence");

    function testOwnerCanAnchorAndReadReceipt() external {
        AgentPlaceReceiptRegistry registry = new AgentPlaceReceiptRegistry();
        registry.anchorReceipt(RECEIPT, JOB, EVIDENCE);

        require(registry.isAnchored(RECEIPT), "receipt should be anchored");
        require(registry.totalAnchors() == 1, "anchor counter mismatch");

        AgentPlaceReceiptRegistry.ReceiptAnchor memory anchor = registry.getAnchor(RECEIPT);
        require(anchor.jobHash == JOB, "job hash mismatch");
        require(anchor.evidenceRoot == EVIDENCE, "evidence root mismatch");
        require(anchor.anchorer == address(this), "anchorer mismatch");
        require(anchor.anchoredAt != 0, "timestamp missing");
    }

    function testDuplicateReceiptIsRejected() external {
        AgentPlaceReceiptRegistry registry = new AgentPlaceReceiptRegistry();
        registry.anchorReceipt(RECEIPT, JOB, EVIDENCE);

        (bool ok,) = address(registry).call(
            abi.encodeCall(AgentPlaceReceiptRegistry.anchorReceipt, (RECEIPT, JOB, EVIDENCE))
        );
        require(!ok, "duplicate anchor must revert");
        require(registry.totalAnchors() == 1, "duplicate changed counter");
    }

    function testUnauthorizedAccountCannotAnchor() external {
        AgentPlaceReceiptRegistry registry = new AgentPlaceReceiptRegistry();
        RegistryCaller caller = new RegistryCaller();

        (bool ok,) = address(caller).call(
            abi.encodeCall(RegistryCaller.anchor, (registry, RECEIPT, JOB, EVIDENCE))
        );
        require(!ok, "unauthorized anchor must revert");
        require(registry.totalAnchors() == 0, "unauthorized anchor changed counter");
    }

    function testOwnerCanAuthorizeAndRevokeAnchorer() external {
        AgentPlaceReceiptRegistry registry = new AgentPlaceReceiptRegistry();
        RegistryCaller caller = new RegistryCaller();

        registry.setAnchorer(address(caller), true);
        require(registry.isAuthorizedAnchorer(address(caller)), "anchorer not authorized");

        caller.anchor(registry, RECEIPT, JOB, EVIDENCE);
        require(registry.totalAnchors() == 1, "authorized anchor failed");

        registry.setAnchorer(address(caller), false);
        require(!registry.isAuthorizedAnchorer(address(caller)), "anchorer not revoked");
    }

    function testZeroHashesAreRejected() external {
        AgentPlaceReceiptRegistry registry = new AgentPlaceReceiptRegistry();

        (bool ok,) = address(registry).call(
            abi.encodeCall(AgentPlaceReceiptRegistry.anchorReceipt, (bytes32(0), JOB, EVIDENCE))
        );
        require(!ok, "zero receipt hash must revert");
    }

    function testOwnershipTransferRequiresAcceptance() external {
        AgentPlaceReceiptRegistry registry = new AgentPlaceReceiptRegistry();
        RegistryCaller nextOwner = new RegistryCaller();

        registry.transferOwnership(address(nextOwner));
        require(registry.owner() == address(this), "ownership changed before acceptance");
        require(registry.pendingOwner() == address(nextOwner), "pending owner mismatch");

        nextOwner.acceptOwnership(registry);
        require(registry.owner() == address(nextOwner), "ownership not transferred");
        require(registry.pendingOwner() == address(0), "pending owner not cleared");
    }
}
