// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Stores changeable predictions and credits non-transferable points without accepting funds.
/// @dev Administrators control matches and pause writes; a trusted settler chooses final results.
/// Settled results cannot be corrected or voided. Anyone may credit settled matches in bounded batches.
contract ScoutReportPredictions is AccessControl, Pausable {
    /// @notice Role permitted to create and void Open matches.
    bytes32 public constant MATCH_ADMIN_ROLE = keccak256("MATCH_ADMIN_ROLE");
    /// @notice Role permitted to settle locked Open matches.
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    /// @notice Maximum non-transferable points awarded for a correct pick.
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

    /// @notice The constructor administrator cannot be the zero address.
    error ZeroAdmin();
    /// @notice A match ID cannot be reused, including after settlement or voiding.
    /// @param matchId ID already assigned to a match.
    error MatchAlreadyExists(bytes32 matchId);
    /// @notice The requested match has not been created.
    /// @param matchId ID without a stored match.
    error UnknownMatch(bytes32 matchId);
    /// @notice Creation requires a lock time strictly later than the current block timestamp.
    error InvalidLockTime();
    /// @notice A match must offer exactly two or three outcomes.
    error InvalidOutcomeCount();
    /// @notice Points per correct pick must be between one and MAX_POINTS_PER_CORRECT inclusive.
    error InvalidPointsForCorrect();
    /// @notice A pick or result must be a zero-based outcome below the match's outcome count.
    error InvalidOutcome();
    /// @notice The requested transition or prediction requires an Open match.
    error MatchNotOpen();
    /// @notice Predictions cannot be made or changed at or after lock time.
    error MatchLocked();
    /// @notice Settlement cannot occur before lock time.
    error MatchNotLocked();
    /// @notice Points can only be credited for a Settled match.
    error MatchNotSettled();
    /// @notice Empty or unrecognised calldata is rejected.
    /// @dev Value-bearing calls also revert because every entry point is non-payable.
    error UnexpectedCall();

    /// @notice Announces a newly created Open match.
    /// @param matchId Unique match ID.
    /// @param lockTime Timestamp at which picks become immutable.
    /// @param outcomeCount Number of zero-based outcomes, either two or three.
    /// @param pointsForCorrect Points to credit for each correct pick, between one and 100.
    event MatchCreated(bytes32 indexed matchId, uint64 lockTime, uint8 outcomeCount, uint32 pointsForCorrect);
    /// @notice Announces the predictor's latest pick, replacing any earlier pick.
    /// @param matchId ID of the Open match.
    /// @param predictor Address making or changing its pick.
    /// @param outcome Selected zero-based outcome.
    event Predicted(bytes32 indexed matchId, address indexed predictor, uint8 outcome);
    /// @notice Announces a final result that cannot be corrected or voided.
    /// @param matchId ID of the now-Settled match.
    /// @param result Winning zero-based outcome.
    event MatchSettled(bytes32 indexed matchId, uint8 result);
    /// @notice Announces a processed predictor range, including incorrect picks.
    /// @dev The range is half-open: [from, to). Equal bounds represent a no-op.
    /// @param matchId ID of the Settled match.
    /// @param from Previous credit cursor, inclusive.
    /// @param to New credit cursor, exclusive.
    event PointsCredited(bytes32 indexed matchId, uint32 from, uint32 to);
    /// @notice Announces a voided match that cannot settle or award points.
    /// @param matchId ID of the previously Open match.
    event MatchVoided(bytes32 indexed matchId);

    mapping(bytes32 => Match) private matches;
    mapping(bytes32 => address[]) private predictors;
    // Zero denotes no prediction; actual outcomes are encoded as outcome + 1.
    mapping(bytes32 => mapping(address => uint8)) private predictions;
    /// @notice Returns an address's cumulative non-transferable prediction points.
    /// @dev The generated getter takes the address to query and is available while paused.
    mapping(address => uint256) public pointsOf;

    /// @notice Assigns initial administrator, match administrator and settler roles.
    /// @dev Operational deployments should separate these roles and protect the administrator.
    /// @param admin Non-zero address receiving all three initial roles.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MATCH_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, admin);
    }

    /// @notice Creates an Open match with a new ID and validated configuration.
    /// @dev Requires MATCH_ADMIN_ROLE and an unpaused contract.
    /// @param matchId Unique ID, conventionally keccak256 of "scoutreport:" and the canonical database UUID.
    /// @param lockTime Future timestamp at which predictions close.
    /// @param outcomeCount Number of zero-based outcomes, either two or three.
    /// @param pointsForCorrect Non-transferable points per correct pick, between one and 100 inclusive.
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
    /// @dev Requires an Open match and an unpaused contract; only the first pick adds a predictor.
    /// @param matchId ID of the match to predict.
    /// @param outcome Zero-based outcome strictly below the match's outcome count.
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

    /// @notice Finalises a locked Open match with a winning outcome.
    /// @dev Requires SETTLER_ROLE and an unpaused contract. The result is final:
    /// a Settled match cannot be settled again, corrected or voided. Points are credited separately.
    /// @param matchId ID of the Open match whose lock time has been reached.
    /// @param result Winning zero-based outcome strictly below the match's outcome count.
    function settle(bytes32 matchId, uint8 result) external onlyRole(SETTLER_ROLE) whenNotPaused {
        Match storage match_ = knownMatch(matchId);
        if (match_.status != Status.Open) revert MatchNotOpen();
        if (block.timestamp < match_.lockTime) revert MatchNotLocked();
        if (result >= match_.outcomeCount) revert InvalidOutcome();
        match_.result = result;
        match_.status = Status.Settled;
        emit MatchSettled(matchId, result);
    }

    /// @notice Voids an Open match without awarding points.
    /// @dev Requires MATCH_ADMIN_ROLE and an unpaused contract. Settled matches cannot be voided.
    /// @param matchId ID of the Open match to void, before or after lock time.
    function voidMatch(bytes32 matchId) external onlyRole(MATCH_ADMIN_ROLE) whenNotPaused {
        Match storage match_ = knownMatch(matchId);
        if (match_.status != Status.Open) revert MatchNotOpen();
        match_.status = Status.Voided;
        emit MatchVoided(matchId);
    }

    /// @notice Permissionlessly credits correct picks in a bounded batch for a Settled match.
    /// @dev Requires an unpaused contract. Advances creditedCursor across winners and losers,
    /// never credits a predictor twice and makes no external calls. Zero or an exhausted cursor is a no-op.
    /// @param matchId ID of the Settled match to credit.
    /// @param maxCount Maximum predictors to process; capped to the number remaining.
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

    /// @notice Returns an address's latest pick for an existing match.
    /// @dev Available while paused; reverts for an unknown match.
    /// @param matchId ID of the match to query.
    /// @param predictor Address whose pick is queried.
    /// @return outcome Zero-based pick, or zero if no pick exists.
    /// @return hasPrediction Whether a pick exists, distinguishing no pick from outcome zero.
    function predictionOf(bytes32 matchId, address predictor)
        external
        view
        returns (uint8 outcome, bool hasPrediction)
    {
        knownMatch(matchId);
        uint8 encoded = predictions[matchId][predictor];
        return encoded == 0 ? (uint8(0), false) : (encoded - 1, true);
    }

    /// @notice Returns the configuration, lifecycle status and credit progress of an existing match.
    /// @dev Available while paused; reverts for an unknown match. Result is meaningful only when Settled.
    /// @param matchId ID of the match to query.
    /// @return Stored match configuration and counters.
    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return knownMatch(matchId);
    }

    /// @notice Pauses match lifecycle changes, predictions and point crediting.
    /// @dev Requires DEFAULT_ADMIN_ROLE; views and role administration remain available.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Resumes match lifecycle changes, predictions and point crediting.
    /// @dev Requires DEFAULT_ADMIN_ROLE; elapsed lock times are not extended by pausing.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function knownMatch(bytes32 matchId) private view returns (Match storage match_) {
        match_ = matches[matchId];
        if (match_.status == Status.None) revert UnknownMatch(matchId);
    }

    /// @notice Rejects empty and unrecognised calldata.
    /// @dev Non-payable, so native-token transfers revert without a payable receive function.
    fallback() external {
        revert UnexpectedCall();
    }
}
