// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {ScoutReportPredictions} from "../src/ScoutReportPredictions.sol";
import {DeployPredictions} from "../script/DeployPredictions.s.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface PredictionsTestVm {
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes calldata reason) external;
    function expectRevert(bytes4 selector) external;
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data) external;
    function chainId(uint256 chainId_) external;
    function deal(address account, uint256 balance) external;
    function setEnv(string calldata name, string calldata value) external;
    function addr(uint256 key) external returns (address);
    function cool(address target) external;
    function toString(uint256 value) external pure returns (string memory);
}

contract ScoutReportPredictionsTest {
    PredictionsTestVm private constant vm = PredictionsTestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant MATCH_ID = keccak256("fixture");
    address private constant ALICE = address(1);
    address private constant BOB = address(2);
    address private constant MATCH_ADMIN = address(3);
    address private constant SETTLER = address(4);
    ScoutReportPredictions private predictions;
    uint64 private deadline;

    event MatchCreated(bytes32 indexed matchId, uint64 lockTime, uint8 outcomeCount, uint32 pointsForCorrect);
    event Predicted(bytes32 indexed matchId, address indexed predictor, uint8 outcome);
    event MatchSettled(bytes32 indexed matchId, uint8 result);
    event PointsCredited(bytes32 indexed matchId, uint32 from, uint32 to);
    event MatchVoided(bytes32 indexed matchId);
    event log_named_uint(string key, uint256 value);

    function setUp() public {
        vm.warp(1_000);
        deadline = 2_000;
        predictions = new ScoutReportPredictions(address(this));
        predictions.grantRole(predictions.MATCH_ADMIN_ROLE(), MATCH_ADMIN);
        predictions.grantRole(predictions.SETTLER_ROLE(), SETTLER);
    }

    function create() private {
        predictions.createMatch(MATCH_ID, deadline, 3, 10);
    }

    function pick(address predictor, uint8 outcome) private {
        vm.prank(predictor);
        predictions.predict(MATCH_ID, outcome);
    }

    function assertError(bytes4 selector, bytes memory callData) private {
        (bool ok, bytes memory reason) = address(predictions).call(callData);
        require(!ok && bytes4(reason) == selector);
    }

    function testConstructorRolesAndZeroAdmin() public {
        require(predictions.hasRole(predictions.DEFAULT_ADMIN_ROLE(), address(this)));
        require(predictions.hasRole(predictions.MATCH_ADMIN_ROLE(), address(this)));
        require(predictions.hasRole(predictions.SETTLER_ROLE(), address(this)));
        require(predictions.getRoleAdmin(predictions.MATCH_ADMIN_ROLE()) == predictions.DEFAULT_ADMIN_ROLE());
        require(predictions.getRoleAdmin(predictions.SETTLER_ROLE()) == predictions.DEFAULT_ADMIN_ROLE());
        require(predictions.supportsInterface(type(IAccessControl).interfaceId));
        vm.expectRevert(ScoutReportPredictions.ZeroAdmin.selector);
        new ScoutReportPredictions(address(0));
    }

    function testCreationStoresExactFieldsAndEmits() public {
        vm.expectEmit(true, false, false, true);
        emit MatchCreated(MATCH_ID, deadline, 3, 10);
        vm.prank(MATCH_ADMIN);
        create();
        ScoutReportPredictions.Match memory match_ = predictions.getMatch(MATCH_ID);
        require(match_.lockTime == deadline && match_.outcomeCount == 3);
        require(match_.result == 0 && match_.pointsForCorrect == 10);
        require(match_.status == ScoutReportPredictions.Status.Open);
        require(match_.predictorCount == 0 && match_.creditedCursor == 0);
        (uint8 outcome, bool hasPrediction) = predictions.predictionOf(MATCH_ID, ALICE);
        require(outcome == 0 && !hasPrediction);
    }

    function testInvalidCreationAndDuplicate() public {
        assertError(
            ScoutReportPredictions.InvalidLockTime.selector,
            abi.encodeCall(predictions.createMatch, (MATCH_ID, uint64(block.timestamp), 2, 1))
        );
        assertError(
            ScoutReportPredictions.InvalidLockTime.selector,
            abi.encodeCall(predictions.createMatch, (MATCH_ID, uint64(block.timestamp - 1), 2, 1))
        );
        for (uint8 count; count < 5; count++) {
            if (count == 2 || count == 3) continue;
            assertError(
                ScoutReportPredictions.InvalidOutcomeCount.selector,
                abi.encodeCall(predictions.createMatch, (MATCH_ID, deadline, count, 1))
            );
        }
        assertError(
            ScoutReportPredictions.InvalidPointsForCorrect.selector,
            abi.encodeCall(predictions.createMatch, (MATCH_ID, deadline, 2, 0))
        );
        assertError(
            ScoutReportPredictions.InvalidPointsForCorrect.selector,
            abi.encodeCall(predictions.createMatch, (MATCH_ID, deadline, 2, 101))
        );
        create();
        vm.expectRevert(abi.encodeWithSelector(ScoutReportPredictions.MatchAlreadyExists.selector, MATCH_ID));
        create();
    }

    function testPointsBoundaryOneAndOneHundred() public {
        require(predictions.MAX_POINTS_PER_CORRECT() == 100);
        predictions.createMatch(MATCH_ID, deadline, 2, 1);
        bytes32 second = keccak256("second");
        predictions.createMatch(second, deadline, 2, 100);
        pick(ALICE, 0);
        vm.prank(ALICE);
        predictions.predict(second, 1);
        vm.warp(deadline);
        predictions.settle(MATCH_ID, 0);
        predictions.settle(second, 1);
        predictions.creditPoints(MATCH_ID, 1);
        require(predictions.pointsOf(ALICE) == 1);
        predictions.creditPoints(second, 1);
        require(predictions.pointsOf(ALICE) == 101);
    }

    function testFirstPickZeroAndChangeOnlyBeforeDeadline() public {
        create();
        vm.expectEmit(true, true, false, true);
        emit Predicted(MATCH_ID, ALICE, 0);
        pick(ALICE, 0);
        (uint8 outcome, bool hasPrediction) = predictions.predictionOf(MATCH_ID, ALICE);
        require(hasPrediction && outcome == 0);
        vm.warp(deadline - 1);
        pick(ALICE, 2);
        pick(ALICE, 1);
        pick(BOB, 0);
        require(predictions.getMatch(MATCH_ID).predictorCount == 2);
        (outcome, hasPrediction) = predictions.predictionOf(MATCH_ID, ALICE);
        require(hasPrediction && outcome == 1);
        vm.warp(deadline);
        vm.expectRevert(ScoutReportPredictions.MatchLocked.selector);
        pick(ALICE, 0);
        vm.expectRevert(ScoutReportPredictions.MatchLocked.selector);
        pick(address(5), 1);
        vm.warp(deadline + 1);
        vm.expectRevert(ScoutReportPredictions.MatchLocked.selector);
        pick(ALICE, 0);
        predictions.settle(MATCH_ID, 1);
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        require(predictions.pointsOf(ALICE) == 10 && predictions.pointsOf(BOB) == 0);
    }

    function testInvalidOutcomesForTwoAndThree() public {
        predictions.createMatch(MATCH_ID, deadline, 2, 10);
        assertError(ScoutReportPredictions.InvalidOutcome.selector, abi.encodeCall(predictions.predict, (MATCH_ID, 2)));
        vm.warp(deadline);
        assertError(ScoutReportPredictions.InvalidOutcome.selector, abi.encodeCall(predictions.settle, (MATCH_ID, 2)));
        bytes32 second = keccak256("second");
        predictions.createMatch(second, deadline + 1, 3, 10);
        assertError(ScoutReportPredictions.InvalidOutcome.selector, abi.encodeCall(predictions.predict, (second, 3)));
        vm.warp(deadline + 1);
        assertError(ScoutReportPredictions.InvalidOutcome.selector, abi.encodeCall(predictions.settle, (second, 255)));
    }

    function testSettlementDeadlineAndDoubleSettlement() public {
        create();
        vm.warp(deadline - 1);
        assertError(ScoutReportPredictions.MatchNotLocked.selector, abi.encodeCall(predictions.settle, (MATCH_ID, 1)));
        assertError(
            ScoutReportPredictions.MatchNotSettled.selector, abi.encodeCall(predictions.creditPoints, (MATCH_ID, 1))
        );
        vm.warp(deadline);
        vm.expectEmit(true, false, false, true);
        emit MatchSettled(MATCH_ID, 1);
        vm.prank(SETTLER);
        predictions.settle(MATCH_ID, 1);
        require(predictions.getMatch(MATCH_ID).result == 1);
        require(predictions.getMatch(MATCH_ID).status == ScoutReportPredictions.Status.Settled);
        assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.settle, (MATCH_ID, 0)));
        assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
        assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.predict, (MATCH_ID, 0)));
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        require(predictions.getMatch(MATCH_ID).creditedCursor == 0);
    }

    function testSettlementAfterDeadline() public {
        create();
        vm.warp(deadline + 1);
        predictions.settle(MATCH_ID, 2);
        require(predictions.getMatch(MATCH_ID).result == 2);
    }

    function testVoidBeforeAndAfterDeadlineAndNoCredits() public {
        create();
        pick(ALICE, 0);
        vm.expectEmit(true, false, false, true);
        emit MatchVoided(MATCH_ID);
        vm.prank(MATCH_ADMIN);
        predictions.voidMatch(MATCH_ID);
        require(predictions.getMatch(MATCH_ID).status == ScoutReportPredictions.Status.Voided);
        assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.predict, (MATCH_ID, 0)));
        assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
        vm.warp(deadline);
        assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.settle, (MATCH_ID, 0)));
        assertError(
            ScoutReportPredictions.MatchNotSettled.selector, abi.encodeCall(predictions.creditPoints, (MATCH_ID, 1))
        );
        require(predictions.pointsOf(ALICE) == 0);
        bytes32 second = keccak256("second");
        predictions.createMatch(second, deadline + 1, 2, 10);
        vm.warp(deadline + 2);
        predictions.voidMatch(second);
        require(predictions.getMatch(second).status == ScoutReportPredictions.Status.Voided);
        vm.expectRevert(abi.encodeWithSelector(ScoutReportPredictions.MatchAlreadyExists.selector, MATCH_ID));
        create();
    }

    function testUnknownMatchEveryReaderAndMutator() public {
        bytes memory reason = abi.encodeWithSelector(ScoutReportPredictions.UnknownMatch.selector, MATCH_ID);
        vm.expectRevert(reason);
        predictions.getMatch(MATCH_ID);
        vm.expectRevert(reason);
        predictions.predictionOf(MATCH_ID, ALICE);
        vm.expectRevert(reason);
        predictions.predict(MATCH_ID, 0);
        vm.expectRevert(reason);
        predictions.settle(MATCH_ID, 0);
        vm.expectRevert(reason);
        predictions.voidMatch(MATCH_ID);
        vm.expectRevert(reason);
        predictions.creditPoints(MATCH_ID, 1);
        require(predictions.pointsOf(ALICE) == 0);
    }

    function expectRole(address caller, bytes32 role, bytes memory callData) private {
        vm.prank(caller);
        (bool ok, bytes memory reason) = address(predictions).call(callData);
        require(!ok);
        require(
            keccak256(reason)
                == keccak256(
                    abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, caller, role)
                )
        );
    }

    function testRolesAreSeparateAndAdminCanRevoke() public {
        bytes32 admin = predictions.DEFAULT_ADMIN_ROLE();
        bytes32 matchAdmin = predictions.MATCH_ADMIN_ROLE();
        bytes32 settler = predictions.SETTLER_ROLE();
        expectRole(ALICE, matchAdmin, abi.encodeCall(predictions.createMatch, (MATCH_ID, deadline, 2, 10)));
        expectRole(SETTLER, matchAdmin, abi.encodeCall(predictions.createMatch, (MATCH_ID, deadline, 2, 10)));
        create();
        expectRole(ALICE, matchAdmin, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
        expectRole(SETTLER, matchAdmin, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
        expectRole(ALICE, settler, abi.encodeCall(predictions.settle, (MATCH_ID, 0)));
        expectRole(MATCH_ADMIN, settler, abi.encodeCall(predictions.settle, (MATCH_ID, 0)));
        expectRole(ALICE, admin, abi.encodeCall(predictions.pause, ()));
        expectRole(MATCH_ADMIN, admin, abi.encodeCall(predictions.pause, ()));
        expectRole(SETTLER, admin, abi.encodeCall(predictions.pause, ()));
        expectRole(ALICE, admin, abi.encodeCall(predictions.grantRole, (settler, ALICE)));
        expectRole(MATCH_ADMIN, admin, abi.encodeCall(predictions.revokeRole, (settler, SETTLER)));
        predictions.revokeRole(settler, SETTLER);
        vm.warp(deadline);
        expectRole(SETTLER, settler, abi.encodeCall(predictions.settle, (MATCH_ID, 0)));
        predictions.grantRole(settler, BOB);
        vm.prank(BOB);
        predictions.settle(MATCH_ID, 0);
    }

    function testPauseBlocksAllProductWritesButNotReadsOrRoleRecovery() public {
        create();
        pick(ALICE, 0);
        predictions.pause();
        require(predictions.paused());
        assertError(
            Pausable.EnforcedPause.selector,
            abi.encodeCall(predictions.createMatch, (keccak256("second"), deadline, 2, 10))
        );
        assertError(Pausable.EnforcedPause.selector, abi.encodeCall(predictions.predict, (MATCH_ID, 1)));
        assertError(Pausable.EnforcedPause.selector, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
        vm.warp(deadline);
        assertError(Pausable.EnforcedPause.selector, abi.encodeCall(predictions.settle, (MATCH_ID, 0)));
        assertError(Pausable.EnforcedPause.selector, abi.encodeCall(predictions.creditPoints, (MATCH_ID, 1)));
        require(predictions.getMatch(MATCH_ID).status == ScoutReportPredictions.Status.Open);
        (uint8 outcome, bool hasPrediction) = predictions.predictionOf(MATCH_ID, ALICE);
        require(hasPrediction && outcome == 0 && predictions.pointsOf(ALICE) == 0);
        expectRole(ALICE, predictions.DEFAULT_ADMIN_ROLE(), abi.encodeCall(predictions.unpause, ()));
        predictions.grantRole(predictions.SETTLER_ROLE(), BOB);
        predictions.unpause();
        predictions.settle(MATCH_ID, 0);
        predictions.pause();
        assertError(Pausable.EnforcedPause.selector, abi.encodeCall(predictions.creditPoints, (MATCH_ID, 1)));
        require(predictions.getMatch(MATCH_ID).creditedCursor == 0);
        predictions.unpause();
        vm.prank(BOB);
        predictions.creditPoints(MATCH_ID, 1);
        require(predictions.pointsOf(ALICE) == 10);
    }

    function testCreditCursorPermissionlessAndNoRepeatedCredits() public {
        create();
        pick(ALICE, 0);
        pick(ALICE, 1);
        pick(BOB, 0);
        vm.warp(deadline);
        predictions.settle(MATCH_ID, 1);
        predictions.creditPoints(MATCH_ID, 0);
        require(predictions.getMatch(MATCH_ID).creditedCursor == 0);
        vm.expectEmit(true, false, false, true);
        emit PointsCredited(MATCH_ID, 0, 1);
        vm.prank(address(5));
        predictions.creditPoints(MATCH_ID, 1);
        require(predictions.getMatch(MATCH_ID).creditedCursor == 1);
        require(predictions.pointsOf(ALICE) == 10 && predictions.pointsOf(BOB) == 0);
        vm.expectEmit(true, false, false, true);
        emit PointsCredited(MATCH_ID, 1, 2);
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        require(predictions.getMatch(MATCH_ID).creditedCursor == 2);
        vm.expectEmit(true, false, false, true);
        emit PointsCredited(MATCH_ID, 2, 2);
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        require(predictions.pointsOf(ALICE) == 10 && predictions.pointsOf(BOB) == 0);
    }

    function testPagination500() public {
        create();
        for (uint256 i; i < 500; i++) {
            pick(address(uint160(i + 100)), 1);
        }
        require(predictions.getMatch(MATCH_ID).predictorCount == 500);
        vm.warp(deadline);
        predictions.settle(MATCH_ID, 1);
        for (uint32 batch; batch < 5; batch++) {
            vm.cool(address(predictions));
            uint256 beforeGas = gasleft();
            predictions.creditPoints(MATCH_ID, 100);
            emit log_named_uint("creditPoints cold batch of 100 gas", beforeGas - gasleft());
            require(predictions.getMatch(MATCH_ID).creditedCursor == (batch + 1) * 100);
        }
        for (uint256 i; i < 500; i++) {
            require(predictions.pointsOf(address(uint160(i + 100))) == 10);
        }
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        require(predictions.pointsOf(address(100)) == 10);
    }

    function testFuzzChangedPickAndCreditBatch(uint8 first, uint8 finalPick, uint8 result, uint256 maxCount) public {
        first %= 3;
        finalPick %= 3;
        result %= 3;
        create();
        pick(ALICE, first);
        pick(ALICE, finalPick);
        pick(BOB, result);
        vm.warp(deadline);
        predictions.settle(MATCH_ID, result);
        predictions.creditPoints(MATCH_ID, maxCount);
        uint32 expectedCursor = maxCount > 2 ? 2 : uint32(maxCount);
        require(predictions.getMatch(MATCH_ID).creditedCursor == expectedCursor);
        require(predictions.pointsOf(ALICE) == (expectedCursor > 0 && finalPick == result ? 10 : 0));
        require(predictions.pointsOf(BOB) == (expectedCursor > 1 ? 10 : 0));
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        predictions.creditPoints(MATCH_ID, type(uint256).max);
        require(predictions.getMatch(MATCH_ID).predictorCount == 2);
        require(predictions.pointsOf(ALICE) == (finalPick == result ? 10 : 0));
        require(predictions.pointsOf(BOB) == 10);
    }

    function testFuzzPointsValidation(uint32 points) public {
        if (points == 0 || points > 100) {
            vm.expectRevert(ScoutReportPredictions.InvalidPointsForCorrect.selector);
            predictions.createMatch(MATCH_ID, deadline, 2, points);
        } else {
            predictions.createMatch(MATCH_ID, deadline, 2, points);
            require(predictions.getMatch(MATCH_ID).pointsForCorrect == points);
        }
    }

    function testFuzzDeadline(uint64 timeSeed) public {
        create();
        uint256 timestamp = 1_000 + uint256(timeSeed) % 2_001;
        vm.warp(timestamp);
        if (timestamp < deadline) {
            pick(ALICE, 0);
            assertError(
                ScoutReportPredictions.MatchNotLocked.selector, abi.encodeCall(predictions.settle, (MATCH_ID, 0))
            );
            vm.warp(deadline);
        } else {
            vm.expectRevert(ScoutReportPredictions.MatchLocked.selector);
            pick(ALICE, 0);
        }
        predictions.settle(MATCH_ID, 0);
        require(predictions.getMatch(MATCH_ID).status == ScoutReportPredictions.Status.Settled);
    }

    function testFuzzDoubleSettlement(uint8 firstResult, uint8 secondResult) public {
        firstResult %= 3;
        secondResult %= 3;
        create();
        pick(ALICE, firstResult);
        vm.warp(deadline);
        predictions.settle(MATCH_ID, firstResult);
        assertError(
            ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.settle, (MATCH_ID, secondResult))
        );
        require(predictions.getMatch(MATCH_ID).result == firstResult);
        predictions.creditPoints(MATCH_ID, 1);
        require(predictions.pointsOf(ALICE) == 10);
    }

    function testFuzzVoid(uint64 timeSeed, uint8 result, bool settleFirst) public {
        result %= 3;
        create();
        pick(ALICE, result);
        vm.warp(1_000 + uint256(timeSeed) % 2_001);
        if (settleFirst) {
            if (block.timestamp < deadline) vm.warp(deadline);
            predictions.settle(MATCH_ID, result);
            assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
            require(predictions.getMatch(MATCH_ID).status == ScoutReportPredictions.Status.Settled);
        } else {
            vm.prank(MATCH_ADMIN);
            predictions.voidMatch(MATCH_ID);
            require(predictions.getMatch(MATCH_ID).status == ScoutReportPredictions.Status.Voided);
            assertError(
                ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.predict, (MATCH_ID, result))
            );
            assertError(
                ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.settle, (MATCH_ID, result))
            );
            assertError(ScoutReportPredictions.MatchNotOpen.selector, abi.encodeCall(predictions.voidMatch, (MATCH_ID)));
            assertError(
                ScoutReportPredictions.MatchNotSettled.selector, abi.encodeCall(predictions.creditPoints, (MATCH_ID, 1))
            );
            require(predictions.pointsOf(ALICE) == 0 && predictions.getMatch(MATCH_ID).creditedCursor == 0);
        }
    }

    function testNoValueAndUnknownCalls() public {
        assertError(ScoutReportPredictions.UnexpectedCall.selector, hex"12345678");
        assertError(ScoutReportPredictions.UnexpectedCall.selector, "");
        vm.deal(address(this), 1 ether);
        (bool emptyOk,) = address(predictions).call{value: 1}("");
        (bool unknownOk,) = address(predictions).call{value: 1}(hex"12345678");
        (bool predictOk,) = address(predictions).call{value: 1}(abi.encodeCall(predictions.predict, (MATCH_ID, 0)));
        require(!emptyOk && !unknownOk && !predictOk && address(predictions).balance == 0);
    }

    function testDeploymentRejectsOtherChainsBeforeReadingKey() public {
        DeployPredictions script = new DeployPredictions();
        vm.chainId(88888);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Spicy only"));
        script.run();
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Spicy only"));
        script.run();
    }

    function testSpicyDeploymentRolesBelongToDeployer() public {
        vm.chainId(88882);
        uint256 fixtureKey = uint256(keccak256("SR-42 public test fixture"));
        vm.setEnv("SPICY_DEPLOYER_PRIVATE_KEY", vm.toString(fixtureKey));
        address deployer = vm.addr(fixtureKey);
        DeployPredictions script = new DeployPredictions();
        ScoutReportPredictions deployed = script.run();
        require(deployed.hasRole(deployed.DEFAULT_ADMIN_ROLE(), deployer));
        require(deployed.hasRole(deployed.MATCH_ADMIN_ROLE(), deployer));
        require(deployed.hasRole(deployed.SETTLER_ROLE(), deployer));
        require(!deployed.hasRole(deployed.DEFAULT_ADMIN_ROLE(), address(script)));
    }
}
