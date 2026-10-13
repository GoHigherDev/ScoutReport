// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ScoutReportPredictions is AccessControl, Pausable {
    bytes32 public constant MATCH_ADMIN_ROLE = keccak256("MATCH_ADMIN_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    uint32 public constant MAX_POINTS_PER_CORRECT = 100;

    enum Status {
        None,
        Open,
        Settled,
        Voided
    }

    struct Match {
        uint64 lockTime;
        uint8 outcomeCount;
        uint8 result;
        uint32 pointsForCorrect;
        Status status;
        uint32 predictorCount;
        uint32 creditedCursor;
    }

    error ZeroAdmin();
    error MatchAlreadyExists(bytes32 matchId);
    error UnknownMatch(bytes32 matchId);
    error InvalidLockTime();
    error InvalidOutcomeCount();
    error InvalidPointsForCorrect();
    error InvalidOutcome();
    error MatchNotOpen();
    error MatchLocked();
    error MatchNotLocked();
    error MatchNotSettled();
    error UnexpectedCall();

    event MatchCreated(bytes32 indexed matchId, uint64 lockTime, uint8 outcomeCount, uint32 pointsForCorrect);
    event Predicted(bytes32 indexed matchId, address indexed predictor, uint8 outcome);
    event MatchSettled(bytes32 indexed matchId, uint8 result);
    event PointsCredited(bytes32 indexed matchId, uint32 from, uint32 to);
    event MatchVoided(bytes32 indexed matchId);

    mapping(bytes32 => Match) private matches;
    mapping(bytes32 => address[]) private predictors;
    // Zero denotes no prediction; actual outcomes are encoded as outcome + 1.
    mapping(bytes32 => mapping(address => uint8)) private predictions;
    mapping(address => uint256) public pointsOf;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MATCH_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, admin);
    }

    function createMatch(bytes32 matchId, uint64 lockTime, uint8 outcomeCount, uint32 pointsForCorrect)
        external
        onlyRole(MATCH_ADMIN_ROLE)
        whenNotPaused
    {
        if (matches[matchId].status != Status.None) revert MatchAlreadyExists(matchId);
        if (lockTime <= block.timestamp) revert InvalidLockTime();
        if (outcomeCount < 2 || outcomeCount > 3) revert InvalidOutcomeCount();
        if (pointsForCorrect == 0 || pointsForCorrect > MAX_POINTS_PER_CORRECT) revert InvalidPointsForCorrect();
        matches[matchId] = Match(lockTime, outcomeCount, 0, pointsForCorrect, Status.Open, 0, 0);
        emit MatchCreated(matchId, lockTime, outcomeCount, pointsForCorrect);
    }

    /// @notice Records one pick per address, changeable only before the match lock time.
    function predict(bytes32 matchId, uint8 outcome) external whenNotPaused {
        Match storage match_ = knownMatch(matchId);
        if (match_.status != Status.Open) revert MatchNotOpen();
        if (block.timestamp >= match_.lockTime) revert MatchLocked();
        if (outcome >= match_.outcomeCount) revert InvalidOutcome();
        if (predictions[matchId][msg.sender] == 0) {
            predictors[matchId].push(msg.sender);
            match_.predictorCount++;
        }
        predictions[matchId][msg.sender] = outcome + 1;
        emit Predicted(matchId, msg.sender, outcome);
    }

    function settle(bytes32 matchId, uint8 result) external onlyRole(SETTLER_ROLE) whenNotPaused {
        Match storage match_ = knownMatch(matchId);
        if (match_.status != Status.Open) revert MatchNotOpen();
        if (block.timestamp < match_.lockTime) revert MatchNotLocked();
        if (result >= match_.outcomeCount) revert InvalidOutcome();
        match_.result = result;
        match_.status = Status.Settled;
        emit MatchSettled(matchId, result);
    }

    function voidMatch(bytes32 matchId) external onlyRole(MATCH_ADMIN_ROLE) whenNotPaused {
        Match storage match_ = knownMatch(matchId);
        if (match_.status != Status.Open) revert MatchNotOpen();
        match_.status = Status.Voided;
        emit MatchVoided(matchId);
    }

    function creditPoints(bytes32 matchId, uint256 maxCount) external whenNotPaused {
        Match storage match_ = knownMatch(matchId);
        if (match_.status != Status.Settled) revert MatchNotSettled();
        uint32 from = match_.creditedCursor;
        uint256 remaining = uint256(match_.predictorCount) - from;
        uint32 to = from + uint32(maxCount < remaining ? maxCount : remaining);
        match_.creditedCursor = to;
        for (uint32 i = from; i < to; i++) {
            address predictor = predictors[matchId][i];
            if (predictions[matchId][predictor] == match_.result + 1) {
                pointsOf[predictor] += match_.pointsForCorrect;
            }
        }
        emit PointsCredited(matchId, from, to);
    }

    function predictionOf(bytes32 matchId, address predictor)
        external
        view
        returns (uint8 outcome, bool hasPrediction)
    {
        knownMatch(matchId);
        uint8 encoded = predictions[matchId][predictor];
        return encoded == 0 ? (uint8(0), false) : (encoded - 1, true);
    }

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return knownMatch(matchId);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function knownMatch(bytes32 matchId) private view returns (Match storage match_) {
        match_ = matches[matchId];
        if (match_.status == Status.None) revert UnknownMatch(matchId);
    }

    fallback() external {
        revert UnexpectedCall();
    }
}
